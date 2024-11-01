import { Text } from "./Text.js";
import { DataTexture, FloatType, RGBAFormat, Vector2, Box3, Color, DynamicDrawUsage } from "three";
import { glyphBoundsAttrName, glyphIndexAttrName } from "./GlyphsGeometry";
import { createDerivedMaterial } from "troika-three-utils";
import { createTextDerivedMaterial } from "./TextDerivedMaterial";

const syncStartEvent = { type: "syncstart" };
const syncCompleteEvent = { type: "synccomplete" };
const memberIndexAttrName = "aTroikaTextBatchMemberIndex";

// 0-15: matrix
// 16: color
// TODO:
// total bounds for uv
// outlineWidth/Color/Opacity/Blur/Offset
// strokeWidth/Color/Opacity
// fillOpacity
// clipRect
let floatsPerMember = 17;
floatsPerMember = Math.ceil(floatsPerMember / 4) * 4; // whole texels

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
 * @todo Support for WebGL1 without OES_texture_float extension (pack floats into 4 ints)
 * @todo Handle more visual uniforms: uv bounds, outlines, etc.
 * @todo Handle things that can't vary between members like sdfGlyphSize - separate batches, or throw?
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

  /**
   * @override
   */
  _prepareForRender (material) {
    // Copy member matrices to the texture
    // TODO only do this once, not once per material

    // Resize the texture to fit in powers of 2
    let texture = this._mat4Texture;
    const dataLength = Math.pow(2, Math.ceil(Math.log2(this._members.size * floatsPerMember)));
    if (!texture || dataLength !== texture.image.data.length) {
      // console.log(`resizing: ${dataLength}`);
      if (texture) texture.dispose();
      const width = Math.min(dataLength / 4, 1024);
      texture = this._mat4Texture = new DataTexture(
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

        // Color
        let color = text.color;
        if (color == null) color = this.color;
        if (color == null) color = this.material.color;
        if (color == null) color = 0xffffff;
        setTexData(startIndex + 16, tempColor.set(color).getHex());

        // TODO:
        // outlineWidth/Color/Opacity/Blur/Offset
        // strokeWidth/Color/Opacity
        // fillOpacity
        // clipRect
      }
    });
    material.setMatrixTexture(texture);

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
    this._mat4Texture.dispose();
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
  const colorVaryingName = "vTroikaTextColor";
  const batchMaterial = createDerivedMaterial(baseMaterial, {
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
      varying vec3 ${colorVaryingName};

      vec4 troikaGetTexel(float i) {
        float w = ${texSizeUniformName}.x;
        vec2 uv = (vec2(mod(i, w), floor(i / w)) + 0.5) / w;
        return texture2D(${texUniformName}, uv);
      }
      vec3 troikaFloatToColor(float v) {
        return mod(floor(vec3(v / 65536.0, v / 256.0, v)), 256.0) / 256.0;
      }
    `,
    // language=GLSL prefix="void main() {" suffix="}"
    vertexTransform: `
      float i = ${memberIndexAttrName} * ${floatsPerMember.toFixed(1)} / 4.0;
      mat4 matrix = mat4(
        troikaGetTexel(i),
        troikaGetTexel(i + 1.0),
        troikaGetTexel(i + 2.0),
        troikaGetTexel(i + 3.0)
      );
      position.xyz = (matrix * vec4(position, 1.0)).xyz;

      float packedColor = troikaGetTexel(i + 4.0).r;
      ${colorVaryingName} = troikaFloatToColor(packedColor);
    `,
    // language=GLSL
    fragmentDefs: `
      varying vec3 ${colorVaryingName};
    `,
    // language=GLSL prefix="void main() {" suffix="}"
    fragmentColorTransform: `
      gl_FragColor.rgb = ${colorVaryingName};
    `
    // TODO: If the base shader has a diffuse color modify that rather than gl_FragColor
    // customRewriter({vertexShader, fragmentShader}) {
    //   return {vertexShader, fragmentShader}
    // },
  });
  batchMaterial.setMatrixTexture = (texture) => {
    batchMaterial.uniforms[texUniformName].value = texture;
    batchMaterial.uniforms[texSizeUniformName].value.set(texture.image.width, texture.image.height);
  };
  return createTextDerivedMaterial(batchMaterial);
}

