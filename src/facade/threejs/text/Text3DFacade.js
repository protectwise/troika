import {assign, assignIf} from '../../../utils'
import Object3DFacade from '../Object3DFacade'
import {
  Mesh,
  PlaneBufferGeometry,
  MeshBasicMaterial,
  DoubleSide,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  Sphere, Vector3, Matrix4
} from 'three'
// import {getTextRenderInfo} from './text/TextBuilderMainThread' //for debugging only
import {getTextRenderInfo} from './TextBuilder'
import {getShadersForMaterial, expandShaderIncludes, voidMainRE} from '../shaderUtils'


const glyphRectGeometry = new PlaneBufferGeometry(1, 1).translate(0.5, 0.5, 0)
const defaultMaterial = new MeshBasicMaterial({color: 0xffffff, side: DoubleSide, transparent: true})
const raycastMesh = new Mesh(glyphRectGeometry.clone(), defaultMaterial)
const propsRequiringRecalc = ['text', 'font', 'fontSize', 'letterSpacing', 'lineHeight', 'maxWidth', 'textAlign', 'anchor']
const noop = () => {}
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

    super(parent, mesh)

    this.text = ''
    this.font = null //will use default from TextBuilder
    this.fontSize = 0.1
    this.letterSpacing = 0
    this.lineHeight = 1.15 //roughly matches a typical CSS 'normal' value
    this.maxWidth = Infinity

    this.material = defaultMaterial

    this._textGeometry = geometry
    this._textInfoRequestId = 0

    this.onBeforeRender = this.onBeforeRender.bind(this)
  }

  afterUpdate() {
    // If our props have changed in a way that affects the text rendering info, request an update
    const lastProps = this._lastTextProps || (this._lastTextProps = {})
    let needsRecalc = propsRequiringRecalc.some(prop => {
      return !(lastProps[prop] === this[prop] ||
        (prop === 'anchor' && JSON.stringify(lastProps[prop]) === JSON.stringify(this[prop])))
    })
    if (needsRecalc) {
      const reqId = ++this._textInfoRequestId
      getTextRenderInfo({
        text: this.text,
        font: this.font,
        fontSize: this.fontSize,
        letterSpacing: this.letterSpacing,
        lineHeight: this.lineHeight,
        maxWidth: this.maxWidth,
        textAlign: this.textAlign,
        anchor: this.anchor
      }, textRenderInfo => {
        //only honor most recent request
        if (this._textInfoRequestId === reqId) {
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

          this.notifyWorld('needsRender')
        }
      })

      propsRequiringRecalc.forEach(prop => {
        lastProps[prop] = this[prop]
      })
    }

    super.afterUpdate()
  }

  onBeforeRender(renderer, scene, camera) {
    const textMaterial = this._getTextMaterial(renderer)
    const textInfo = this._textRenderInfo
    const uniforms = textMaterial.uniforms
    if (textInfo) {
      const sdfTexture = textInfo.sdfTexture
      uniforms.uTroikaSDFTexture.value = sdfTexture
      uniforms.uTroikaSDFMinDistancePct.value = textInfo.sdfMinDistancePercent
      uniforms.uTroikaGlyphVSize.value = sdfTexture.image.width / sdfTexture.image.height
    }
    uniforms.uTroikaSDFDebug.value = !!this.debugSDF
    this.threeObject.material = textMaterial
  }

  _getTextMaterial(renderer) {
    let textMaterial = this._textMaterial
    const baseMaterial = this.material || defaultMaterial
    if (!textMaterial || textMaterial._baseMaterial !== baseMaterial) {
      if (textMaterial) {
        textMaterial.dispose()
      }

      const baseShaders = getShadersForMaterial(baseMaterial)
      const derivativesSupported = renderer.extensions.get('OES_standard_derivatives')
      const upgradedShaders = upgradeShaders(baseShaders.vertexShader, baseShaders.fragmentShader, derivativesSupported)

      // Clone the material and upgrade it
      textMaterial = this._textMaterial = baseMaterial.clone()
      textMaterial._baseMaterial = baseMaterial
      textMaterial.transparent = true //force transparency - TODO is this reasonable?
      textMaterial.defines = assignIf({TROIKA_TEXT: ''}, baseMaterial.defines)
      textMaterial.uniforms = assignIf({ //create uniforms holders; their values will be set in onBeforeRender
        uTroikaSDFTexture: {value: null},
        uTroikaSDFMinDistancePct: {value: 0},
        uTroikaGlyphVSize: {value: 0},
        uTroikaSDFDebug: {value: false}
      }, baseShaders.uniforms)
      if (derivativesSupported) {
        textMaterial.extensions = assignIf({derivatives: true}, baseMaterial.extensions)
      }
      textMaterial.onBeforeCompile = shaderInfo => {
        // Inject the upgraded shaders/uniforms into the program on first compile
        assign(shaderInfo, upgradedShaders)
        shaderInfo.uniforms = textMaterial.uniforms
        textMaterial.onBeforeCompile = null //just once
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
    return this._textGeometry.boundingSphere
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


function updateBufferAttrArray(attr, newArray) {
  if (attr.array.length === newArray.length) {
    attr.array.set(newArray)
  } else {
    attr.setArray(newArray)
  }
  attr.needsUpdate = true
}


function upgradeShaders(vertexShader, fragmentShader, derivativesSupported) {
  // Pre-expand includes
  vertexShader = expandShaderIncludes(vertexShader)
  fragmentShader = expandShaderIncludes(fragmentShader)

  // Rename all 'position' attribute refs to a runtime variable so we can modify it
  vertexShader = vertexShader.replace(/\bposition\b/g, (match, index, fullStr) => {
    return /\battribute\s+vec3\s+$/.test(fullStr.substr(0, index)) ? match : 'troika_position'
  })

  vertexShader = vertexShader.replace(voidMainRE, `
uniform float uTroikaGlyphVSize;
attribute vec4 aTroikaGlyphBounds;
attribute float aTroikaGlyphIndex;
varying vec2 vTroikaGlyphUV;

$&

vTroikaGlyphUV = vec2(
  position.x,
  uTroikaGlyphVSize * (aTroikaGlyphIndex + position.y)
);

vec3 troika_position = vec3(
  position.x == 1.0 ? aTroikaGlyphBounds.z : aTroikaGlyphBounds.x,
  position.y == 1.0 ? aTroikaGlyphBounds.w : aTroikaGlyphBounds.y,
  0.0
);`
  )

  fragmentShader = fragmentShader.replace(voidMainRE, `
uniform sampler2D uTroikaSDFTexture;
uniform float uTroikaSDFMinDistancePct;
uniform bool uTroikaSDFDebug;
uniform float uTroikaGlyphVSize;
varying vec2 vTroikaGlyphUV;

$&`
  ).replace(
    /\bgl_FragColor\s*=\s*[^;]*;/, //only first match - TODO we probably want to put this after the last ref...?
    `
$&

float troikaSDFValue = texture2D(uTroikaSDFTexture, vTroikaGlyphUV).r;
float troikaAntiAliasDist = ${derivativesSupported ?
  // When the standard derivatives extension is available, we choose an antialiasing alpha threshold based
  // on the potential change in the SDF's alpha from this fragment to its neighbor. This strategy maximizes 
  // readability and edge crispness at all sizes and screen resolutions. Interestingly, this also means that 
  // below a minimum size we're effectively displaying the SDF texture unmodified.
  `min(
    0.5,
    0.5 * min(
      fwidth(vTroikaGlyphUV.x), 
      fwidth(vTroikaGlyphUV.y / uTroikaGlyphVSize)
    )
  ) / uTroikaSDFMinDistancePct` :
  // Fallback for no derivatives extension:
  '0.01'
};
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
