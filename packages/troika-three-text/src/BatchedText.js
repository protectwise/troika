import { Text } from "./Text.js";
import { DataTexture, FloatType, RGBAFormat, Vector2, Box3, Color, DynamicDrawUsage } from "three";
import { glyphBoundsAttrName, glyphIndexAttrName } from "./GlyphsGeometry";
import { createDerivedMaterial } from "troika-three-utils";
import { createTextDerivedMaterial } from "./TextDerivedMaterial";

const syncStartEvent = { type: "syncstart" };
const syncCompleteEvent = { type: "synccomplete" };
const memberIndexAttrName = "aTroikaTextBatchMemberIndex";


/*
Data texture packing strategy:

# Common:
0-15: matrix
16-19: uTroikaTotalBounds
20-23: uTroikaClipRect
24: diffuse (color/outlineColor)
25: uTroikaFillOpacity (fillOpacity/outlineOpacity)
26: uTroikaCurveRadius
27: <blank>

# Main:
28: uTroikaStrokeWidth
29: uTroikaStrokeColor
30: uTroikaStrokeOpacity

# Outline:
28-29: uTroikaPositionOffset
30: uTroikaEdgeOffset
31: uTroikaBlurRadius
*/
const floatsPerMember = 32;

const tempBox3 = new Box3();
const tempColor = new Color();

/**
 * @experimental
 *
 * A specialized `Text` implementation that accepts any number of `Text` children
 * and automatically batches them together to render in a single draw call.
 *
 * The `material` of each child `Text` will be ignored, and the `material` of the
 * `BatchedText` will be used for all of them instead.
 *
 * NOTE: This only works in WebGL2 or where the OES_texture_float extension is available.
 */
export class BatchedText extends Text {
  constructor () {
    super();

    /**
     * @typedef {Object} PackingInfo
     * @property {number} index - the packing order index when last packed, or -1
     * @property {boolean} dirty - whether it has synced since last pack
     */

    /**
     * @type {Map<Text, PackingInfo>}
     */
    this._members = new Map();
    this._dataTextures = {}

    this._onMemberSynced = (e) => {
      this._members.get(e.target).dirty = true;
    };
    this._onMemberRemoved = (e) => {
      this.removeText(e.target);
    };
  }

  /**
   * @override
   * Batch any Text objects added as children
   */
  add (...objects) {
    for (let i = 0; i < objects.length; i++) {
      if (objects[i] instanceof Text) {
        this.addText(objects[i]);
      } else {
        super.add(objects[i]);
      }
    }
    return this;
  }

  /**
   * @param {Text} text
   */
  addText (text) {
    if (!this._members.has(text)) {
      this._members.set(text, {
        index: -1,
        glyphCount: -1,
        dirty: true
      });
      text.addEventListener("removed", this._onMemberRemoved);
      text.addEventListener("synccomplete", this._onMemberSynced);
    }
  }

  /**
   * @param {Text} text
   */
  removeText (text) {
    text.removeEventListener("removed", this._onMemberRemoved);
    text.removeEventListener("synccomplete", this._onMemberSynced);
    this._members.delete(text);
  }

  /**
   * Use the custom derivation with extra batching logic
   */
  createDerivedMaterial (baseMaterial) {
    return createBatchedTextMaterial(baseMaterial);
  }

  updateMatrixWorld (force) {
    super.updateMatrixWorld(force);
    this.updateBounds();
  }

  /**
   * Update the batched geometry bounds to hold all members
   */
  updateBounds () {
    // Update member local matrices and the overall bounds
    const bbox = this.geometry.boundingBox.makeEmpty();
    this._members.forEach((_, text) => {
      if (text.matrixAutoUpdate) text.updateMatrix(); // ignore world matrix
      tempBox3.copy(text.geometry.boundingBox).applyMatrix4(text.matrix);
      bbox.union(tempBox3);
    });
    bbox.getBoundingSphere(this.geometry.boundingSphere);
  }

  /** @override */
  hasOutline() {
    return this._members.keys().some(m => m.hasOutline())
  }

  /**
   * @override
   * Copy member matrices and uniform values into the data texture
   */
  _prepareForRender (material) {
    const isOutline = material.isTextOutlineMaterial
    material.uniforms.uTroikaIsOutline.value = isOutline

    // Resize the texture to fit in powers of 2
    let texture = this._dataTextures[isOutline ? 'outline' : 'main'];
    const dataLength = Math.pow(2, Math.ceil(Math.log2(this._members.size * floatsPerMember)));
    if (!texture || dataLength !== texture.image.data.length) {
      // console.log(`resizing: ${dataLength}`);
      if (texture) texture.dispose();
      const width = Math.min(dataLength / 4, 1024);
      texture = this[isOutline ? 'outline' : 'main'] = new DataTexture(
        new Float32Array(dataLength),
        width,
        dataLength / 4 / width,
        RGBAFormat,
        FloatType
      );
    }

    const texData = texture.image.data;
    const setTexData = (index, value) => {
      if (value !== texData[index]) {
        texData[index] = value;
        texture.needsUpdate = true;
      }
    }
    this._members.forEach(({ index, dirty }, text) => {
      if (index > -1) {
        const startIndex = index * floatsPerMember

        // Matrix
        const matrix = text.matrix.elements;
        for (let i = 0; i < 16; i++) {
          setTexData(startIndex + i, matrix[i])
        }

        // Let the member populate the uniforms, since that does all the appropriate
        // logic and handling of defaults, and we'll just grab the results from there
        text._prepareForRender(material)
        const {
          uTroikaTotalBounds,
          uTroikaClipRect,
          uTroikaPositionOffset,
          uTroikaEdgeOffset,
          uTroikaBlurRadius,
          uTroikaStrokeWidth,
          uTroikaStrokeColor,
          uTroikaStrokeOpacity,
          uTroikaFillOpacity,
          uTroikaCurveRadius,
        } = material.uniforms;

        // Total bounds for uv
        for (let i = 0; i < 4; i++) {
          setTexData(startIndex + 16 + i, uTroikaTotalBounds.value.getComponent(i));
        }

        // Clip rect
        for (let i = 0; i < 4; i++) {
          setTexData(startIndex + 20 + i, uTroikaClipRect.value.getComponent(i));
        }

        // Color
        let color = isOutline ? (text.outlineColor || 0) : text.color;
        if (color == null) color = this.color;
        if (color == null) color = this.material.color;
        if (color == null) color = 0xffffff;
        setTexData(startIndex + 24, tempColor.set(color).getHex());

        // Fill opacity / outline opacity
        setTexData(startIndex + 25, uTroikaFillOpacity.value)

        // Curve radius
        setTexData(startIndex + 26, uTroikaCurveRadius.value)

        if (isOutline) {
          // Outline properties
          setTexData(startIndex + 28, uTroikaPositionOffset.value.x);
          setTexData(startIndex + 29, uTroikaPositionOffset.value.y);
          setTexData(startIndex + 30, uTroikaEdgeOffset.value);
          setTexData(startIndex + 31, uTroikaBlurRadius.value);
        } else {
          // Stroke properties
          setTexData(startIndex + 28, uTroikaStrokeWidth.value);
          setTexData(startIndex + 29, tempColor.set(uTroikaStrokeColor.value).getHex());
          setTexData(startIndex + 30, uTroikaStrokeOpacity.value);
        }
      }
    });
    material.setMatrixTexture(texture);

    // For the non-member-specific uniforms:
    super._prepareForRender(material);
  }

  sync (callback) {
    // TODO: skip members updating their geometries, just use textRenderInfo directly

    // Trigger sync on all members that need it
    let syncPromises;
    this._members.forEach((packingInfo, text) => {
      if (packingInfo.dirty || text._needsSync) {
        packingInfo.dirty = false;
        (syncPromises || (syncPromises = [])).push(new Promise(resolve => {
          if (text._needsSync) {
            text.sync(resolve);
          } else {
            resolve();
          }
        }));
      }
    });

    // If any needed syncing, wait for them and then repack the batched geometry
    if (syncPromises) {
      this.dispatchEvent(syncStartEvent);

      Promise.all(syncPromises).then(() => {
        const { geometry } = this;
        const batchedAttributes = geometry.attributes;
        let memberIndexes = batchedAttributes[memberIndexAttrName] && batchedAttributes[memberIndexAttrName].array || new Uint16Array(0);
        let batchedGlyphIndexes = batchedAttributes[glyphIndexAttrName] && batchedAttributes[glyphIndexAttrName].array || new Float32Array(0);
        let batchedGlyphBounds = batchedAttributes[glyphBoundsAttrName] && batchedAttributes[glyphBoundsAttrName].array || new Float32Array(0);

        // Initial pass to collect total glyph count and resize the arrays if needed
        let totalGlyphCount = 0;
        this._members.forEach((packingInfo, { textRenderInfo }) => {
          if (textRenderInfo) {
            totalGlyphCount += textRenderInfo.glyphAtlasIndices.length;
            this._textRenderInfo = textRenderInfo; // TODO - need this, but be smarter
          }
        });
        if (totalGlyphCount !== memberIndexes.length) {
          memberIndexes = cloneAndResize(memberIndexes, totalGlyphCount);
          batchedGlyphIndexes = cloneAndResize(batchedGlyphIndexes, totalGlyphCount);
          batchedGlyphBounds = cloneAndResize(batchedGlyphBounds, totalGlyphCount * 4);
        }

        // Populate batch arrays
        let memberIndex = 0;
        let glyphIndex = 0;
        this._members.forEach((packingInfo, { textRenderInfo }) => {
          if (textRenderInfo) {
            const glyphCount = textRenderInfo.glyphAtlasIndices.length;
            memberIndexes.fill(memberIndex, glyphIndex, glyphIndex + glyphCount);

            // TODO can skip these for members that are not dirty or shifting overall position:
            batchedGlyphIndexes.set(textRenderInfo.glyphAtlasIndices, glyphIndex, glyphIndex + glyphCount);
            batchedGlyphBounds.set(textRenderInfo.glyphBounds, glyphIndex * 4, (glyphIndex + glyphCount) * 4);

            glyphIndex += glyphCount;
            packingInfo.index = memberIndex++;
          }
        });

        // Update the geometry attributes
        geometry.updateAttributeData(memberIndexAttrName, memberIndexes, 1);
        geometry.getAttribute(memberIndexAttrName).setUsage(DynamicDrawUsage);
        geometry.updateAttributeData(glyphIndexAttrName, batchedGlyphIndexes, 1);
        geometry.updateAttributeData(glyphBoundsAttrName, batchedGlyphBounds, 4);

        this.updateBounds();

        this.dispatchEvent(syncCompleteEvent);
        if (callback) {
          callback();
        }
      });
    }
  }

  copy (source) {
    if (source instanceof BatchedText) {
      super.copy(source);
      this._members.forEach((_, text) => this.removeText(text));
      source._members.forEach((_, text) => this.addText(text));
    }
    return this;
  }

  dispose () {
    super.dispose();
    Object.values(this._dataTextures).forEach(tex => tex.dispose())
  }
}

function cloneAndResize (source, newLength) {
  const copy = new source.constructor(newLength);
  copy.set(source.subarray(0, newLength));
  return copy;
}

function createBatchedTextMaterial (baseMaterial) {
  const texUniformName = "uTroikaMatricesTexture";
  const texSizeUniformName = "uTroikaMatricesTextureSize";

  // Due to how vertexTransform gets injected, the matrix transforms must happen
  // in the base material of TextDerivedMaterial, but other transforms to its
  // shader must come after, so we sandwich it between two derivations.

  // Transform the vertex position
  let batchMaterial = createDerivedMaterial(baseMaterial, {
    chained: true,
    uniforms: {
      [texSizeUniformName]: { value: new Vector2() },
      [texUniformName]: { value: null }
    },
    // language=GLSL
    vertexDefs: `
      uniform highp sampler2D ${texUniformName};
      uniform vec2 ${texSizeUniformName};
      attribute float ${memberIndexAttrName};

      vec4 troikaBatchTexel(float offset) {
        offset += ${memberIndexAttrName} * ${floatsPerMember.toFixed(1)} / 4.0;
        float w = ${texSizeUniformName}.x;
        vec2 uv = (vec2(mod(offset, w), floor(offset / w)) + 0.5) / ${texSizeUniformName};
        return texture2D(${texUniformName}, uv);
      }
    `,
    // language=GLSL prefix="void main() {" suffix="}"
    vertexTransform: `
      mat4 matrix = mat4(
        troikaBatchTexel(0.0),
        troikaBatchTexel(1.0),
        troikaBatchTexel(2.0),
        troikaBatchTexel(3.0)
      );
      position.xyz = (matrix * vec4(position, 1.0)).xyz;
    `,
  });

  // Add the text shaders
  batchMaterial = createTextDerivedMaterial(batchMaterial);

  // Now make other changes to the derived text shader code
  batchMaterial = createDerivedMaterial(batchMaterial, {
    chained: true,
    uniforms: {
      uTroikaIsOutline: {value: false},
    },
    customRewriter(shaders) {
      // Convert some text shader uniforms to varyings
      const varyingUniforms = [
        'uTroikaTotalBounds',
        'uTroikaClipRect',
        'uTroikaPositionOffset',
        'uTroikaEdgeOffset',
        'uTroikaBlurRadius',
        'uTroikaStrokeWidth',
        'uTroikaStrokeColor',
        'uTroikaStrokeOpacity',
        'uTroikaFillOpacity',
        'uTroikaCurveRadius',
        'diffuse'
      ]
      varyingUniforms.forEach(uniformName => {
        shaders = uniformToVarying(shaders, uniformName)
      })
      return shaders
    },
    // language=GLSL
    vertexDefs: `
      uniform bool uTroikaIsOutline;
      vec3 troikaFloatToColor(float v) {
        return mod(floor(vec3(v / 65536.0, v / 256.0, v)), 256.0) / 256.0;
      }
    `,
    // language=GLSL prefix="void main() {" suffix="}"
    vertexTransform: `
      uTroikaTotalBounds = troikaBatchTexel(4.0);
      uTroikaClipRect = troikaBatchTexel(5.0);
      
      vec4 data = troikaBatchTexel(6.0);
      diffuse = troikaFloatToColor(data.x);
      uTroikaFillOpacity = data.y;
      uTroikaCurveRadius = data.z;
      
      data = troikaBatchTexel(7.0);
      if (uTroikaIsOutline) {
        if (data == vec4(0.0)) { // degenerate if zero outline
          position = vec3(0.0);
        } else {
          uTroikaPositionOffset = data.xy;
          uTroikaEdgeOffset = data.z;
          uTroikaBlurRadius = data.w;
        }
      } else {
        uTroikaStrokeWidth = data.x;
        uTroikaStrokeColor = troikaFloatToColor(data.y);
        uTroikaStrokeOpacity = data.z;
      }
    `,
  });

  batchMaterial.setMatrixTexture = (texture) => {
    batchMaterial.uniforms[texUniformName].value = texture;
    batchMaterial.uniforms[texSizeUniformName].value.set(texture.image.width, texture.image.height);
  };
  return batchMaterial;
}

/**
 * Turn a uniform into a varying/writeable value.
 * - If the uniform was used in the fragment shader, it will become a varying in both shaders.
 * - If the uniform was only used in the vertex shader, it will become a writeable var.
 */
export function uniformToVarying({vertexShader, fragmentShader}, uniformName, varyingName = uniformName) {
  const uniformRE = new RegExp(`uniform\\s+(bool|float|vec[234]|mat[34])\\s+${uniformName}\\b`)

  let type
  let hadFragmentUniform = false
  fragmentShader = fragmentShader.replace(uniformRE, ($0, $1) => {
    hadFragmentUniform = true
    return `varying ${type = $1} ${varyingName}`
  })

  let hadVertexUniform = false
  vertexShader = vertexShader.replace(uniformRE, (_, $1) => {
    hadVertexUniform = true
    return `${hadFragmentUniform ? 'varying' : ''} ${type = $1} ${varyingName}`
  })
  if (!hadVertexUniform) {
    vertexShader = `${hadFragmentUniform ? 'varying' : ''} ${type} ${varyingName};\n${vertexShader}`
  }
  return {vertexShader, fragmentShader}
}

