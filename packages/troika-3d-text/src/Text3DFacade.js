import { utils } from 'troika-core'
import { Object3DFacade, shaderUtils } from 'troika-3d'
import {
  Mesh,
  PlaneBufferGeometry,
  MeshBasicMaterial,
  DoubleSide,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  Sphere,
  Vector3,
  Vector4,
  Matrix4
} from 'three'
import {getTextRenderInfo} from './TextBuilder'

const {assign, assignIf} = utils
const {getShadersForMaterial, expandShaderIncludes, voidMainRE} = shaderUtils

const glyphRectGeometry = new PlaneBufferGeometry(1, 1).translate(0.5, 0.5, 0)
const defaultMaterial = new MeshBasicMaterial({color: 0xffffff, side: DoubleSide, transparent: true})
const raycastMesh = new Mesh(glyphRectGeometry.clone(), defaultMaterial)
const propsRequiringRecalc = ['text', 'font', 'fontSize', 'letterSpacing', 'lineHeight', 'whiteSpace', 'overflowWrap', 'maxWidth', 'textAlign', 'anchor']
const noop = () => {}
const noclip = Object.freeze([0, 0, 0, 0])
const tempVec3 = new Vector3()
const tempMat4 = new Matrix4()

class Text3DFacade extends Object3DFacade {
  constructor(parent) {
    const geometry = new InstancedBufferGeometry().copy(glyphRectGeometry)
    geometry.maxInstancedCount = 0
    geometry.addAttribute('aTroikaGlyphBounds', new InstancedBufferAttribute(new Float32Array(0), 4))
    geometry.addAttribute('aTroikaGlyphIndex', new InstancedBufferAttribute(new Float32Array(0), 1))
    geometry.boundingSphere = new Sphere()
    geometry.boundingSphere.version = 0
    geometry.computeBoundingSphere = noop //we'll handle bounding sphere updates ourselves

    const mesh = new Mesh(geometry, defaultMaterial.clone())
    mesh.renderOrder = Number.MAX_SAFE_INTEGER

    super(parent, mesh)
    
    this._textGeometry = geometry
  }

  afterUpdate() {
    // If our props have changed in a way that affects the text rendering info, request an update
    const lastProps = this._lastTextProps || (this._lastTextProps = {})
    let needsRecalc = propsRequiringRecalc.some(prop => {
      return !(lastProps[prop] === this[prop] ||
        (prop === 'anchor' && JSON.stringify(lastProps[prop]) === JSON.stringify(this[prop])))
    })
    if (needsRecalc) {
      if (!this._hasActiveTextRequest) {
        this._hasActiveTextRequest = true

        getTextRenderInfo({
          text: this.text,
          font: this.font,
          fontSize: this.fontSize,
          letterSpacing: this.letterSpacing,
          lineHeight: this.lineHeight,
          maxWidth: this.maxWidth,
          textAlign: this.textAlign,
          whiteSpace: this.whiteSpace,
          overflowWrap: this.overflowWrap,
          anchor: this.anchor
        }, textRenderInfo => {
          // Save result for later use in onBeforeRender
          this._textRenderInfo = textRenderInfo

          // Populate geometry attributes
          const geometry = this._textGeometry
          const {aTroikaGlyphBounds, aTroikaGlyphIndex} = geometry.attributes
          updateBufferAttrArray(aTroikaGlyphBounds, textRenderInfo.glyphBounds)
          updateBufferAttrArray(aTroikaGlyphIndex, textRenderInfo.glyphIndices)
          geometry.maxInstancedCount = textRenderInfo.glyphIndices.length

          // Update geometry's bounding sphere for raycasting/frustum culling
          const totalBounds = textRenderInfo.totalBounds
          const sphere = geometry.boundingSphere
          sphere.center.set(
            (totalBounds[0] + totalBounds[2]) / 2,
            (totalBounds[1] + totalBounds[3]) / 2,
            0
          )
          sphere.radius = sphere.center.distanceTo(tempVec3.set(totalBounds[0], totalBounds[1], 0))
          sphere.version++

          this._hasActiveTextRequest = false
          this.afterUpdate()
          this.notifyWorld('needsRender')
        })

        propsRequiringRecalc.forEach(prop => {
          lastProps[prop] = this[prop]
        })
      }
    }

    this._prepareMaterial()

    super.afterUpdate()
  }

  _prepareMaterial() {
    const textMaterial = this._getTextMaterial()
    const textInfo = this._textRenderInfo
    const uniforms = textMaterial.uniforms
    if (textInfo) {
      const sdfTexture = textInfo.sdfTexture
      uniforms.uTroikaSDFTexture.value = sdfTexture
      uniforms.uTroikaSDFMinDistancePct.value = textInfo.sdfMinDistancePercent
      uniforms.uTroikaGlyphVSize.value = sdfTexture.image.width / sdfTexture.image.height
      uniforms.uTroikaTotalBounds.value.fromArray(textInfo.totalBounds)
    }
    uniforms.uTroikaSDFDebug.value = !!this.debugSDF

    let clipRect = this.clipRect
    if (!(clipRect && Array.isArray(clipRect) && clipRect.length === 4)) { clipRect = noclip }
    uniforms.uTroikaClipRect.value.fromArray(clipRect)

    textMaterial.polygonOffset = !!this.depthOffset
    textMaterial.polygonOffsetFactor = textMaterial.polygonOffsetUnits = this.depthOffset || 0

    this.threeObject.material = textMaterial
  }

  _getTextMaterial() {
    let textMaterial = this._textMaterial
    const baseMaterial = this.material || defaultMaterial
    if (!textMaterial || textMaterial._baseMaterial !== baseMaterial) {
      if (textMaterial) {
        textMaterial.dispose()
      }

      const baseShaders = getShadersForMaterial(baseMaterial)
      const upgradedShaders = upgradeShaders(baseShaders.vertexShader, baseShaders.fragmentShader)

      // Clone the material and upgrade it
      textMaterial = this._textMaterial = baseMaterial.clone()
      textMaterial._baseMaterial = baseMaterial
      textMaterial.transparent = true //force transparency - TODO is this reasonable?
      textMaterial.defines = assignIf({TROIKA_TEXT: ''}, baseMaterial.defines)
      textMaterial.uniforms = assignIf({
        uTroikaSDFTexture: {value: null},
        uTroikaSDFMinDistancePct: {value: 0},
        uTroikaGlyphVSize: {value: 0},
        uTroikaTotalBounds: {value: new Vector4()},
        uTroikaClipRect: {value: new Vector4()},
        uTroikaSDFDebug: {value: false}
      }, baseShaders.uniforms)
      textMaterial.extensions = assignIf({derivatives: true}, baseMaterial.extensions)
      textMaterial.onBeforeCompile = shaderInfo => {
        // Inject the upgraded shaders/uniforms before program switch
        baseMaterial.onBeforeCompile.call(this, shaderInfo)
        assign(shaderInfo, upgradedShaders)
        shaderInfo.uniforms = textMaterial.uniforms
      }
    }

    // shortcut for setting material color via facade prop:
    const color = this.color
    if (color != null && textMaterial.color && textMaterial.color.isColor && color !== textMaterial._troikaColor) {
      textMaterial.color.set(textMaterial._troikaColor = color)
    }

    return textMaterial
  }

  /**
   * @override Use our textGeometry's boundingSphere which we keep updated as we get new
   * text rendering metrics.
   */
  _getGeometryBoundingSphere() {
    const sphere = this._textGeometry.boundingSphere
    return sphere.radius ? sphere : null
  }

  /**
   * @override Custom raycaster to test against the whole text block's max rectangular bounds
   * TODO is there any reason to make this more granular, like within individual line or glyph rects?
   */
  raycast(raycaster) {
    const textInfo = this._textRenderInfo
    if (textInfo) {
      const bounds = textInfo.totalBounds
      raycastMesh.matrixWorld.multiplyMatrices(
        this.threeObject.matrixWorld,
        tempMat4.set(
          bounds[2] - bounds[0], 0, 0, bounds[0],
          0, bounds[3] - bounds[1], 0, bounds[1],
          0, 0, 1, 0,
          0, 0, 0, 1
        )
      )
      return this._raycastObject(raycastMesh, raycaster)
    }
    return null
  }

  destructor() {
    const textMaterial = this._textMaterial
    if (textMaterial) {
      textMaterial.dispose()
    }
    this._textGeometry.dispose()
    super.destructor()
  }
}

// Defaults
assign(Text3DFacade.prototype, {
  text: '',
  font: null, //will use default from TextBuilder
  fontSize: 0.1,
  letterSpacing: 0,
  lineHeight: 'normal',
  maxWidth: Infinity,
  depthOffset: 0,
  material: defaultMaterial
})


function updateBufferAttrArray(attr, newArray) {
  if (attr.array.length === newArray.length) {
    attr.array.set(newArray)
  } else {
    attr.setArray(newArray)
  }
  attr.needsUpdate = true
}


function upgradeShaders(vertexShader, fragmentShader) {
  // Pre-expand includes
  vertexShader = expandShaderIncludes(vertexShader)
  fragmentShader = expandShaderIncludes(fragmentShader)

  // Rename all 'position' and 'uv' attribute refs to runtime variables so we can modify them
  vertexShader = vertexShader.replace(/\b(?:position|uv)\b/g, (match, index, fullStr) => {
    return /\battribute\s+vec[23]\s+$/.test(fullStr.substr(0, index)) ? match : `troika_${match}`
  })

  vertexShader = vertexShader.replace(voidMainRE, `
uniform float uTroikaGlyphVSize;
uniform vec4 uTroikaTotalBounds;
attribute vec4 aTroikaGlyphBounds;
attribute float aTroikaGlyphIndex;
varying vec2 vTroikaGlyphUV;
varying vec3 vTroikaLocalPos;

$&

vTroikaGlyphUV = vec2(
  position.x,
  uTroikaGlyphVSize * (aTroikaGlyphIndex + position.y)
);

vec3 troika_position = vec3(
  position.x == 1.0 ? aTroikaGlyphBounds.z : aTroikaGlyphBounds.x,
  position.y == 1.0 ? aTroikaGlyphBounds.w : aTroikaGlyphBounds.y,
  0.0
);
vTroikaLocalPos = vec3(troika_position);

vec2 troika_uv = vec2( ${''/*TODO make this conditional on whether uv/vUv is actually used*/}
  (troika_position.x - uTroikaTotalBounds.x) / (uTroikaTotalBounds.z - uTroikaTotalBounds.x),
  (troika_position.y - uTroikaTotalBounds.y) / (uTroikaTotalBounds.w - uTroikaTotalBounds.y)
);
`
  )

  fragmentShader = fragmentShader.replace(voidMainRE, `
uniform sampler2D uTroikaSDFTexture;
uniform float uTroikaSDFMinDistancePct;
uniform bool uTroikaSDFDebug;
uniform float uTroikaGlyphVSize;
uniform vec4 uTroikaClipRect;
varying vec2 vTroikaGlyphUV;
varying vec3 vTroikaLocalPos;

void troikaApplyClipping() {
  vec4 rect = uTroikaClipRect;
  vec3 pos = vTroikaLocalPos;
  if (rect != vec4(.0,.0,.0,.0) && (
    pos.x < min(rect.x, rect.z) || 
    pos.y < min(rect.y, rect.w) ||
    pos.x > max(rect.x, rect.z) ||
    pos.y > max(rect.y, rect.w)
  )) {
    discard;
  }
}

$&`
  ).replace(
    /\bgl_FragColor\s*=\s*[^;]*;/, //only first match - TODO we probably want to put this after the last ref...?
    `
$&

troikaApplyClipping();

float troikaSDFValue = texture2D(uTroikaSDFTexture, vTroikaGlyphUV).r;

${''/*
When the standard derivatives extension is available, we choose an antialiasing alpha threshold based
on the potential change in the SDF's alpha from this fragment to its neighbor. This strategy maximizes 
readability and edge crispness at all sizes and screen resolutions. Interestingly, this also means that 
below a minimum size we're effectively displaying the SDF texture unmodified.
*/}
#ifdef GL_OES_standard_derivatives
  float troikaAntiAliasDist = min(
    0.5,
    0.5 * min(
      fwidth(vTroikaGlyphUV.x), 
      fwidth(vTroikaGlyphUV.y / uTroikaGlyphVSize)
    )
  ) / uTroikaSDFMinDistancePct;
#else
  float troikaAntiAliasDist = 0.01;
#endif

float textAlphaMult = uTroikaSDFDebug ? troikaSDFValue : smoothstep(
  0.5 - troikaAntiAliasDist,
  0.5 + troikaAntiAliasDist,
  troikaSDFValue
);
if (textAlphaMult == 0.0) {
  if (uTroikaSDFDebug) {
    gl_FragColor *= 0.5;
  } else {
    discard;
  }
} else {
  gl_FragColor.a *= textAlphaMult;
}`
  )

  return {vertexShader, fragmentShader}
}



export default Text3DFacade
