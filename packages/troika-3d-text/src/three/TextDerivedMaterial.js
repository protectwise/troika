import { createDerivedMaterial, voidMainRegExp } from 'troika-three-utils'
import { Vector2, Vector4, Matrix3 } from 'three'

// language=GLSL
const VERTEX_DEFS = `
uniform vec2 uTroikaSDFTextureSize;
uniform float uTroikaSDFGlyphSize;
uniform vec4 uTroikaTotalBounds;
uniform vec4 uTroikaClipRect;
uniform mat3 uTroikaOrient;
uniform bool uTroikaUseGlyphColors;
attribute vec4 aTroikaGlyphBounds;
attribute float aTroikaGlyphIndex;
attribute vec3 aTroikaGlyphColor;
varying vec2 vTroikaSDFTextureUV;
varying vec2 vTroikaGlyphUV;
varying vec3 vTroikaGlyphColor;
`

// language=GLSL prefix="void main() {" suffix="}"
const VERTEX_TRANSFORM = `
vec4 bounds = aTroikaGlyphBounds;
vec4 clippedBounds = vec4(
  clamp(bounds.xy, uTroikaClipRect.xy, uTroikaClipRect.zw),
  clamp(bounds.zw, uTroikaClipRect.xy, uTroikaClipRect.zw)
);
vec2 clippedXY = (mix(clippedBounds.xy, clippedBounds.zw, position.xy) - bounds.xy) / (bounds.zw - bounds.xy);
vTroikaGlyphUV = clippedXY.xy;

float cols = uTroikaSDFTextureSize.x / uTroikaSDFGlyphSize;
vTroikaSDFTextureUV = vec2(
  mod(aTroikaGlyphIndex, cols) + clippedXY.x,
  floor(aTroikaGlyphIndex / cols) + clippedXY.y
) * uTroikaSDFGlyphSize / uTroikaSDFTextureSize;

position.xy = mix(bounds.xy, bounds.zw, clippedXY);

uv = vec2(
  (position.x - uTroikaTotalBounds.x) / (uTroikaTotalBounds.z - uTroikaTotalBounds.x),
  (position.y - uTroikaTotalBounds.y) / (uTroikaTotalBounds.w - uTroikaTotalBounds.y)
);

position = uTroikaOrient * position;
normal = uTroikaOrient * normal;
`

// language=GLSL
const FRAGMENT_DEFS = `
uniform sampler2D uTroikaSDFTexture;
uniform float uTroikaSDFMinDistancePct;
uniform bool uTroikaSDFDebug;
varying vec2 vTroikaSDFTextureUV;
varying vec2 vTroikaGlyphUV;

float troikaGetTextAlpha() {
  float troikaSDFValue = texture2D(uTroikaSDFTexture, vTroikaSDFTextureUV).r;
  
  #if defined(IS_DEPTH_MATERIAL) || defined(IS_DISTANCE_MATERIAL)
  float alpha = step(0.5, troikaSDFValue);
  #else
  ${''/*
    When the standard derivatives extension is available, we choose an antialiasing alpha threshold based
    on the potential change in the SDF's alpha from this fragment to its neighbor. This strategy maximizes 
    readability and edge crispness at all sizes and screen resolutions. Interestingly, this also means that 
    below a minimum size we're effectively displaying the SDF texture unmodified.
  */}
  #if defined(GL_OES_standard_derivatives) || __VERSION__ >= 300
  float aaDist = min(
    0.5,
    0.5 * min(
      fwidth(vTroikaGlyphUV.x),
      fwidth(vTroikaGlyphUV.y)
    )
  ) / uTroikaSDFMinDistancePct;
  #else
  float aaDist = 0.01;
  #endif
  
  float alpha = uTroikaSDFDebug ? troikaSDFValue : smoothstep(
    0.5 - aaDist,
    0.5 + aaDist,
    troikaSDFValue
  );
  #endif
  
  return alpha;
}
`

// language=GLSL prefix="void main() {" suffix="}"
const FRAGMENT_TRANSFORM = `
float troikaAlphaMult = troikaGetTextAlpha();
if (troikaAlphaMult == 0.0) {
  discard;
} else {
  gl_FragColor.a *= troikaAlphaMult;
}
`


/**
 * Create a material for rendering text, derived from a baseMaterial
 */
export function createTextDerivedMaterial(baseMaterial) {
  const textMaterial = createDerivedMaterial(baseMaterial, {
    extensions: {derivatives: true},
    uniforms: {
      uTroikaSDFTexture: {value: null},
      uTroikaSDFTextureSize: {value: new Vector2()},
      uTroikaSDFGlyphSize: {value: 0},
      uTroikaSDFMinDistancePct: {value: 0},
      uTroikaTotalBounds: {value: new Vector4(0,0,0,0)},
      uTroikaClipRect: {value: new Vector4(0,0,0,0)},
      uTroikaOrient: {value: new Matrix3()},
      uTroikaUseGlyphColors: {value: true},
      uTroikaSDFDebug: {value: false}
    },
    vertexDefs: VERTEX_DEFS,
    vertexTransform: VERTEX_TRANSFORM,
    fragmentDefs: FRAGMENT_DEFS,
    fragmentColorTransform: FRAGMENT_TRANSFORM,
    customRewriter({vertexShader, fragmentShader}) {
      let uDiffuseRE = /\buniform\s+vec3\s+diffuse\b/
      if (uDiffuseRE.test(fragmentShader)) {
        // Replace all instances of `diffuse` with our varying
        fragmentShader = fragmentShader
          .replace(uDiffuseRE, 'varying vec3 vTroikaGlyphColor')
          .replace(/\bdiffuse\b/g, 'vTroikaGlyphColor')
        // Make sure the vertex shader declares the uniform so we can grab it as a fallback
        if (!uDiffuseRE.test(vertexShader)) {
          vertexShader = vertexShader.replace(
            voidMainRegExp,
            'uniform vec3 diffuse;\n$&\nvTroikaGlyphColor = uTroikaUseGlyphColors ? aTroikaGlyphColor / 255.0 : diffuse;\n'
          )
        }
      }
      return { vertexShader, fragmentShader }
    }
  })

  // Force transparency - TODO is this reasonable?
  textMaterial.transparent = true

  Object.defineProperties(textMaterial, {
    isTroikaTextMaterial: {value: true},

    // WebGLShadowMap reverses the side of the shadow material by default, which fails
    // for planes, so here we force the `shadowSide` to always match the main side.
    shadowSide: {
      get() {
        return this.side
      },
      set() {
        //no-op
      }
    }
  })

  return textMaterial
}



