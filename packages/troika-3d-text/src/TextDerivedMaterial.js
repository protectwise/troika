import { createDerivedMaterial } from 'troika-3d'
import { Vector4 } from 'three'

const VERTEX_DEFS = `
uniform float uTroikaGlyphVSize;
uniform vec4 uTroikaTotalBounds;
attribute vec4 aTroikaGlyphBounds;
attribute float aTroikaGlyphIndex;
varying vec2 vTroikaGlyphUV;
varying vec3 vTroikaLocalPos;
`

const VERTEX_TRANSFORM = `
vTroikaGlyphUV = vec2(
  position.x,
  uTroikaGlyphVSize * (aTroikaGlyphIndex + position.y)
);

position = vec3(
  position.x == 1.0 ? aTroikaGlyphBounds.z : aTroikaGlyphBounds.x,
  position.y == 1.0 ? aTroikaGlyphBounds.w : aTroikaGlyphBounds.y,
  0.0
);
vTroikaLocalPos = vec3(position);

uv = vec2(
  (position.x - uTroikaTotalBounds.x) / (uTroikaTotalBounds.z - uTroikaTotalBounds.x),
  (position.y - uTroikaTotalBounds.y) / (uTroikaTotalBounds.w - uTroikaTotalBounds.y)
);
`

const FRAGMENT_DEFS = `
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
`

const FRAGMENT_TRANSFORM = `
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
      uTroikaSDFMinDistancePct: {value: 0},
      uTroikaGlyphVSize: {value: 0},
      uTroikaTotalBounds: {value: new Vector4()},
      uTroikaClipRect: {value: new Vector4()},
      uTroikaSDFDebug: {value: false}
    },
    vertexDefs: VERTEX_DEFS,
    vertexTransform: VERTEX_TRANSFORM,
    fragmentDefs: FRAGMENT_DEFS,
    fragmentColorTransform: FRAGMENT_TRANSFORM
  })

  //force transparency - TODO is this reasonable?
  textMaterial.transparent = true

  return textMaterial
}



