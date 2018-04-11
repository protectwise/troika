import { assign, assignIf } from '../../../utils'
import { expandShaderIncludes, getShadersForMaterial, voidMainRE } from '../shaderUtils'
import { Color, Mesh, MeshBasicMaterial, PlaneBufferGeometry, UniformsUtils, Vector2, Vector4 } from 'three'
import Object3DFacade from '../Object3DFacade'

const geometry = new PlaneBufferGeometry(1, 1).translate(0.5, -0.5, 0)
const defaultBgMaterial = new MeshBasicMaterial({color: 0})
const noclip = Object.freeze(new Vector4())


/**
 * A single layer in a UI Block's rendering, e.g. background or border. All layers honor
 * border radius, which is calculated shader-side for perfectly smooth curves at any scale,
 * with antialiasing.
 *
 * You shouldn't have to use this directly; UIBlock3DFacade will create these as needed
 * based on background/border styles.
 */
class UIBlockLayer3DFacade extends Object3DFacade {
  constructor(parent) {
    const mesh = new Mesh(geometry, defaultBgMaterial)
    mesh.frustumCulled = false //TODO moot if we make this an Instanceable, otherwise need to fix culling by transformed size
    super(parent, mesh)

    this._colorObj = new Color()

    // Properties
    // this.size = new Vector2()
    // this.borderRadius = new Vector4()
    // this.borderWidth = new Vector4()
    // this.color = 0
    // this.material = null
    // this.isBorder = false
  }

  afterUpdate() {
    const {color} = this

    // Ensure we're using an upgraded material
    const layerMaterial = this.threeObject.material = this._getUpgradedMaterial()

    layerMaterial.polygonOffset = !!this.depthOffset
    layerMaterial.polygonOffsetFactor = layerMaterial.polygonOffsetUnits = this.depthOffset || 0
    this.threeObject.renderOrder = -this.depthOffset //TODO how can we make this play with the rest of the scene?

    // Set material uniform values
    const uniforms = layerMaterial.uniforms
    uniforms.uTroikaBlockSize.value = this.size
    uniforms.uTroikaCornerRadii.value = this.borderRadius
    uniforms.uTroikaClipRect.value = this.clipRect || noclip
    if (this.isBorder) {
      uniforms.uTroikaBorderWidth.value = this.borderWidth
    }
    if (color !== this._lastColor) {
      this._colorObj.set(color)
      this._lastColor = color
    }

    super.afterUpdate()
  }

  getBoundingSphere() {
    return null //parent will handle bounding sphere and raycasting
  }

  _getUpgradedMaterial() {
    const baseMaterial = this.material || defaultBgMaterial
    let upgradedMaterial = this._upgradedMaterial
    if (!upgradedMaterial || upgradedMaterial._baseMaterial !== baseMaterial) {
      if (upgradedMaterial) {upgradedMaterial.dispose()}

      const baseShaders = getShadersForMaterial(baseMaterial)
      const upgradedShaders = upgradeShaders(baseShaders.vertexShader, baseShaders.fragmentShader)

      // Clone the material and upgrade it
      upgradedMaterial = this._upgradedMaterial = baseMaterial.clone()
      upgradedMaterial._baseMaterial = baseMaterial
      upgradedMaterial.transparent = true //force transparency - TODO is this reasonable?
      upgradedMaterial.color = this._colorObj
      upgradedMaterial.defines = assignIf({
        TROIKA_UI_BLOCK: ''
      }, baseMaterial.defines)
      if (this.isBorder) {
        upgradedMaterial.defines.TROIKA_UI_BORDER = ''
      }
      upgradedMaterial.uniforms = assignIf({
        uTroikaBlockSize: {value: new Vector2()},
        uTroikaClipRect: {value: new Vector4()},
        uTroikaCornerRadii: {value: new Vector4()},
        uTroikaBorderWidth: {value: new Vector4()}
      }, UniformsUtils.clone(baseShaders.uniforms))
      upgradedMaterial.extensions = assignIf({derivatives: true}, baseMaterial.extensions)
      upgradedMaterial.onBeforeCompile = shaderInfo => {
        // Inject the upgraded shaders/uniforms before program switch
        baseMaterial.onBeforeCompile.call(this, shaderInfo)
        assign(shaderInfo, upgradedShaders)
        shaderInfo.uniforms = upgradedMaterial.uniforms
      }
    }

    return upgradedMaterial
  }


  destructor() {
    const material = this._upgradedMaterial
    if (material) {
      material.dispose()
    }
    super.destructor()
  }
}



function upgradeShaders(vertexShader, fragmentShader, derivativesSupported) {
  // Pre-expand includes
  vertexShader = expandShaderIncludes(vertexShader)
  fragmentShader = expandShaderIncludes(fragmentShader)

  // Rename all vertex shader 'position' attribute refs to a runtime variable so we can modify it
  vertexShader = vertexShader.replace(/\bposition\b/g, (match, index, fullStr) => {
    return /\battribute\s+vec3\s+$/.test(fullStr.substr(0, index)) ? match : 'troika_position'
  })

  // Upgrade vertex shader
  vertexShader = vertexShader.replace(voidMainRE, `
uniform vec2 uTroikaBlockSize;
varying vec2 vTroikaPosInBlock;

$&

vTroikaPosInBlock = vec2(position.x, -position.y) * uTroikaBlockSize;
vec3 troika_position = vec3(vec2(position.x, position.y) * uTroikaBlockSize, position.z);
`
  )

  // Upgrade fragment shader
  fragmentShader = fragmentShader.replace(voidMainRE, `
uniform vec2 uTroikaBlockSize;
uniform vec4 uTroikaClipRect;
uniform vec4 uTroikaCornerRadii;
uniform vec4 uTroikaBorderWidth;
varying vec2 vTroikaPosInBlock;

float troikaEllipseRadiusAtAngle(in float angle, in float rx, in float ry) {
  if (rx == ry) {return rx;}
  float _cos = cos(angle);
  float _sin = sin(angle);
  return 1.0 / sqrt((_cos*_cos)/(rx*rx) + (_sin*_sin)/(ry*ry));
}

void troikaGetCurveDists(
  in vec2 pos, in vec2 radCenter, in float outerR, in float xBorder, in float yBorder, 
  out float dOuter, out float dInner
) {
  vec2 adjPos = pos - radCenter;
  float angle = atan(adjPos.y, adjPos.x);
  dOuter = troikaEllipseRadiusAtAngle(angle, outerR, outerR) - length(adjPos);
  #ifdef TROIKA_UI_BORDER
  dInner = troikaEllipseRadiusAtAngle(angle, max(0.0, outerR - xBorder), max(0.0, outerR - yBorder)) - length(adjPos);
  #endif
}

float troikaGetAlphaMultiplier() {
  // Short aliases
  vec2 dim = uTroikaBlockSize;
  vec4 rad = uTroikaCornerRadii;
  vec4 bdr = uTroikaBorderWidth;
  vec2 pos = vTroikaPosInBlock;
  vec4 clip = uTroikaClipRect;

  float dOuter;
  float dInner;

  // Top left
  if (pos.x <= rad[0] && pos.y <= rad[0]) {
    troikaGetCurveDists(pos, vec2(rad[0], rad[0]), rad[0], bdr[3], bdr[0], dOuter, dInner);
  }
  // Top Right
  else if (pos.x >= dim.x - rad[1] && pos.y <= rad[1]) {
    troikaGetCurveDists(pos, vec2(dim.x - rad[1], rad[1]), rad[1], bdr[1], bdr[0], dOuter, dInner);
  }
  // Bottom Right
  else if (pos.x >= dim.x - rad[2] && pos.y >= dim.y - rad[2]) {
    troikaGetCurveDists(pos, vec2(dim.x - rad[2], dim.y - rad[2]), rad[2], bdr[1], bdr[2], dOuter, dInner);
  }
  // Bottom Left
  else if (pos.x <= rad[3] && pos.y >= dim.y - rad[3]) {
    troikaGetCurveDists(pos, vec2(rad[3], dim.y - rad[3]), rad[3], bdr[3], bdr[2], dOuter, dInner);
  }
  // Not on a curve, use closest side
  else {
    dOuter = min(min(pos.x, pos.y), min(dim.x - pos.x, dim.y - pos.y));
    #ifdef TROIKA_UI_BORDER
    dInner = min(min(pos.x - bdr[3], pos.y - bdr[0]), min(dim.x - pos.x - bdr[1], dim.y - pos.y - bdr[2]));
    #endif
  }
  
  // Clipping rect
  if (clip != vec4(0.,0.,0.,0.)) {
    float dClip = min(
      min(pos.x - min(clip.x, clip.z), max(clip.x, clip.z) - pos.x),
      min(pos.y - min(clip.y, clip.w), max(clip.y, clip.w) - pos.y)
    );
    dOuter = min(dOuter, dClip);
  }

  #ifdef GL_OES_standard_derivatives
    #ifdef TROIKA_UI_BORDER
      if (dOuter == dInner) {return 0.0;}
      float aa = max(fwidth(pos.x), fwidth(pos.y)) * 0.5;
      return min(
        smoothstep(-aa, aa, dOuter),
        smoothstep(aa, -aa, dInner)
      );
    #else
      float aa = fwidth(dOuter) * 0.5;
      return smoothstep(-aa, aa, dOuter);
    #endif
  #else
    #ifdef TROIKA_UI_BORDER
      return min(step(0.0, dOuter), step(0.0, -dInner));
    #else
      return step(0.0, dOuter);
    #endif
  #endif
}

$&`
  ).replace(
    /\bgl_FragColor\s*=\s*[^;]*;/, //only first match - TODO we probably want to put this after the last ref...?
    `
$&

float troikaAlphaMult = troikaGetAlphaMultiplier();
if (troikaAlphaMult == 0.0) {
  discard;
} else {
  gl_FragColor.a *= troikaAlphaMult;
}
`
  )

  return {vertexShader, fragmentShader}
}



export default UIBlockLayer3DFacade
