import { createDerivedMaterial } from 'troika-3d'
import { Vector2, Vector4 } from 'three'

// language=GLSL
const VERTEX_DEFS = `
uniform vec2 uTroikaBlockSize;
varying vec2 vTroikaPosInBlock;
`

// language=GLSL prefix="void main() {" suffix="}"
const VERTEX_TRANSFORM = `
vTroikaPosInBlock = vec2(position.x, -position.y) * uTroikaBlockSize;
position.xy *= uTroikaBlockSize;
`

// language=GLSL
const FRAGMENT_DEFS = `
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
  float dClip;
  bool isOnCurve = true;

  // Top left
  if (pos.x < rad[0] && pos.y < rad[0]) {
    troikaGetCurveDists(pos, vec2(rad[0], rad[0]), rad[0], bdr[3], bdr[0], dOuter, dInner);
  }
  // Top Right
  else if (pos.x > dim.x - rad[1] && pos.y < rad[1]) {
    troikaGetCurveDists(pos, vec2(dim.x - rad[1], rad[1]), rad[1], bdr[1], bdr[0], dOuter, dInner);
  }
  // Bottom Right
  else if (pos.x > dim.x - rad[2] && pos.y > dim.y - rad[2]) {
    troikaGetCurveDists(pos, vec2(dim.x - rad[2], dim.y - rad[2]), rad[2], bdr[1], bdr[2], dOuter, dInner);
  }
  // Bottom Left
  else if (pos.x < rad[3] && pos.y > dim.y - rad[3]) {
    troikaGetCurveDists(pos, vec2(rad[3], dim.y - rad[3]), rad[3], bdr[3], bdr[2], dOuter, dInner);
  }
  // Not on a curve, use closest side
  else {
    isOnCurve = false;
    dOuter = min(min(pos.x, pos.y), min(dim.x - pos.x, dim.y - pos.y));
    #ifdef TROIKA_UI_BORDER
    dInner = min(min(pos.x - bdr[3], pos.y - bdr[0]), min(dim.x - pos.x - bdr[1], dim.y - pos.y - bdr[2]));
    #endif
  }
  
  // Clipping rect
  dClip = min(
    min(pos.x - min(clip.x, clip.z), max(clip.x, clip.z) - pos.x),
    min(pos.y - min(clip.y, clip.w), max(clip.y, clip.w) - pos.y)
  );

  float alpha;
  #if defined(GL_OES_standard_derivatives) || __VERSION__ >= 300
    float aa = length(fwidth(pos)) * 0.5;
    alpha = (isOnCurve || dClip < dOuter) ? smoothstep(-aa, aa, min(dClip, dOuter)) : 1.0;
    #ifdef TROIKA_UI_BORDER
    alpha = min(alpha, (dOuter == dInner) ? 0.0 : smoothstep(aa, -aa, dInner));
    #endif
    return alpha;
  #else
    alpha = step(0.0, min(dClip, dOuter));
    #ifdef TROIKA_UI_BORDER
    alpha = min(alpha, step(0.0, -dInner));
    #endif
  #endif
  return alpha;
}
`

// language=GLSL prefix="void main() {" suffix="}"
const FRAGMENT_COLOR_TRANSFORM = `
float troikaAlphaMult = troikaGetAlphaMultiplier();
if (troikaAlphaMult == 0.0) {
  discard;
} else {
  gl_FragColor.a *= troikaAlphaMult;
}
`


export function createUIBlockLayerDerivedMaterial(baseMaterial, isBorder) {
  const material = createDerivedMaterial(baseMaterial, {
    defines: {
      [`TROIKA_UI_${isBorder ? 'BORDER' : 'BG'}`]: ''
    },
    extensions: {
      derivatives: true
    },
    uniforms: {
      uTroikaBlockSize: {value: new Vector2()},
      uTroikaClipRect: {value: new Vector4()},
      uTroikaCornerRadii: {value: new Vector4()},
      uTroikaBorderWidth: {value: new Vector4()}
    },
    vertexDefs: VERTEX_DEFS,
    vertexTransform: VERTEX_TRANSFORM,
    fragmentDefs: FRAGMENT_DEFS,
    fragmentColorTransform: FRAGMENT_COLOR_TRANSFORM
  })


  //force transparency - TODO is this reasonable?
  material.transparent = true

  return material
}