import { createDerivedMaterial, voidMainRegExp } from 'troika-three-utils'
import { Color, Vector2, Vector4, Matrix3 } from 'three'

// language=GLSL
const VERTEX_DEFS = `
uniform vec2 uTroikaSDFTextureSize;
uniform float uTroikaSDFGlyphSize;
uniform vec4 uTroikaTotalBounds;
uniform vec4 uTroikaClipRect;
uniform mat3 uTroikaOrient;
uniform bool uTroikaUseGlyphColors;
uniform float uTroikaOutlineWidth;
attribute vec4 aTroikaGlyphBounds;
attribute float aTroikaGlyphIndex;
attribute vec3 aTroikaGlyphColor;
varying float vTroikaGlyphIndex;
varying vec2 vTroikaGlyphUV;
varying vec3 vTroikaGlyphColor;
varying vec2 vTroikaGlyphDimensions;
`

// language=GLSL prefix="void main() {" suffix="}"
const VERTEX_TRANSFORM = `
vec4 bounds = aTroikaGlyphBounds;
vec4 outlineBounds = vec4(bounds.xy - uTroikaOutlineWidth, bounds.zw + uTroikaOutlineWidth);
vec4 clippedBounds = vec4(
  clamp(outlineBounds.xy, uTroikaClipRect.xy, uTroikaClipRect.zw),
  clamp(outlineBounds.zw, uTroikaClipRect.xy, uTroikaClipRect.zw)
);
vec2 clippedXY = (mix(clippedBounds.xy, clippedBounds.zw, position.xy) - bounds.xy) / (bounds.zw - bounds.xy);

position.xy = mix(bounds.xy, bounds.zw, clippedXY);

uv = (position.xy - uTroikaTotalBounds.xy) / (uTroikaTotalBounds.zw - uTroikaTotalBounds.xy);

position = uTroikaOrient * position;
normal = uTroikaOrient * normal;

vTroikaGlyphIndex = aTroikaGlyphIndex;
vTroikaGlyphUV = clippedXY.xy;
vTroikaGlyphDimensions = vec2(bounds[2] - bounds[0], bounds[3] - bounds[1]);
`

// language=GLSL
const FRAGMENT_DEFS = `
uniform sampler2D uTroikaSDFTexture;
uniform vec2 uTroikaSDFTextureSize;
uniform float uTroikaSDFGlyphSize;
uniform float uTroikaSDFExponent;
uniform float uTroikaOutlineWidth;
uniform vec3 uTroikaOutlineColor;
uniform bool uTroikaSDFDebug;
varying vec2 vTroikaGlyphUV;
varying float vTroikaGlyphIndex;
varying vec2 vTroikaGlyphDimensions;

float troikaSdfValueToSignedDistance(float alpha) {
  // Inverse of encoding in SDFGenerator.js
  ${''/* TODO - there's some slight inaccuracy here when dealing with interpolated alpha values; those
    are linearly interpolated where the encoding is exponential. Look into improving this by rounding
    to nearest 2 whole texels, decoding those exponential values, and linearly interpolating the result.
  */}
  float maxDimension = max(vTroikaGlyphDimensions.x, vTroikaGlyphDimensions.y);
  float absDist = (1.0 - pow(2.0 * (alpha > 0.5 ? 1.0 - alpha : alpha), 1.0 / uTroikaSDFExponent)) * maxDimension;
  float signedDist = absDist * (alpha > 0.5 ? -1.0 : 1.0);
  return signedDist;
}

float troikaGlyphUvToSdfValue(vec2 uv) {
  float cols = uTroikaSDFTextureSize.x / uTroikaSDFGlyphSize;
  vec2 textureUV = vec2(
    mod(vTroikaGlyphIndex, cols) + uv.x,
    floor(vTroikaGlyphIndex / cols) + uv.y
  ) * uTroikaSDFGlyphSize / uTroikaSDFTextureSize;
  return texture2D(uTroikaSDFTexture, textureUV).r;
}

float troikaGlyphUvToDistance(vec2 uv) {
  return troikaSdfValueToSignedDistance(troikaGlyphUvToSdfValue(uv));
}

vec4 troikaGetTextColor(float distanceOffset, vec4 bgColor, vec4 fgColor) {
  vec2 clampedGlyphUV = clamp(vTroikaGlyphUV, 0.5 / uTroikaSDFGlyphSize, 1.0 - 0.5 / uTroikaSDFGlyphSize);
  float distance = troikaGlyphUvToDistance(clampedGlyphUV);
    
  if (clampedGlyphUV != vTroikaGlyphUV) {
    // Naive extrapolated distance:
    float distToUnclamped = length((vTroikaGlyphUV - clampedGlyphUV) * vTroikaGlyphDimensions);
    distance += distToUnclamped;

    ${''/* 
    // TODO more refined extrapolated distance by adjusting for angle of gradient at edge...
    // This has potential but currently gives very jagged extensions, maybe due to precision issues?
    float uvStep = 1.0 / uTroikaSDFGlyphSize;
    vec2 neighbor1UV = clampedGlyphUV + (
      vTroikaGlyphUV.x != clampedGlyphUV.x ? vec2(0.0, uvStep * sign(0.5 - vTroikaGlyphUV.y)) :
      vTroikaGlyphUV.y != clampedGlyphUV.y ? vec2(uvStep * sign(0.5 - vTroikaGlyphUV.x), 0.0) :
      vec2(0.0)
    );
    vec2 neighbor2UV = clampedGlyphUV + (
      vTroikaGlyphUV.x != clampedGlyphUV.x ? vec2(0.0, uvStep * -sign(0.5 - vTroikaGlyphUV.y)) :
      vTroikaGlyphUV.y != clampedGlyphUV.y ? vec2(uvStep * -sign(0.5 - vTroikaGlyphUV.x), 0.0) :
      vec2(0.0)
    );
    float neighbor1Distance = troikaGlyphUvToDistance(neighbor1UV);
    float neighbor2Distance = troikaGlyphUvToDistance(neighbor2UV);
    float distToUnclamped = length((vTroikaGlyphUV - clampedGlyphUV) * vTroikaGlyphDimensions);
    float distToNeighbor = length((clampedGlyphUV - neighbor1UV) * vTroikaGlyphDimensions);
    float gradientAngle1 = min(asin(abs(neighbor1Distance - distance) / distToNeighbor), PI / 2.0);
    float gradientAngle2 = min(asin(abs(neighbor2Distance - distance) / distToNeighbor), PI / 2.0);
    distance += (cos(gradientAngle1) + cos(gradientAngle2)) / 2.0 * distToUnclamped;
    */}
  }
  
  #if defined(IS_DEPTH_MATERIAL) || defined(IS_DISTANCE_MATERIAL)
  float alpha = 1.0 - step(distanceOffset, distance);
  #else
  ${''/*
    When the standard derivatives extension is available, we choose an antialiasing alpha threshold based
    on the potential change in the SDF's alpha from this fragment to its neighbor. This strategy maximizes 
    readability and edge crispness at all sizes and screen resolutions.
  */}
  #if defined(GL_OES_standard_derivatives) || __VERSION__ >= 300
  float aaDist = length(fwidth(vTroikaGlyphUV * vTroikaGlyphDimensions)) * 0.5;
  #else
  float aaDist = vTroikaGlyphDimensions.x / 64.0;
  #endif
  
  float alpha = smoothstep(
    distanceOffset + aaDist,
    distanceOffset - aaDist,
    distance
  );
  #endif
  
  return mix(bgColor, fgColor, alpha);
}
`

// language=GLSL prefix="void main() {" suffix="}"
const FRAGMENT_TRANSFORM = `
vec4 outlineColor = uTroikaOutlineWidth > 0.0
  ? troikaGetTextColor(uTroikaOutlineWidth, vec4(uTroikaOutlineColor, 0.0), vec4(uTroikaOutlineColor, 1.0))
  : vec4(gl_FragColor.rgb, 0.0);
gl_FragColor = troikaGetTextColor(0.0, outlineColor, gl_FragColor);

// Shift depth of outlines back so they don't cover up neighboring glyphs
// TODO must make this work in Safari and other WebGL1 impls without the extension
#if defined(EXT_frag_depth) || __VERSION__ >= 300
gl_FragDepth = gl_FragCoord.z + (uTroikaOutlineWidth > 0.0 && gl_FragColor == outlineColor ? 1e-6 : 0.0);
#endif

// Debug raw SDF
gl_FragColor = uTroikaSDFDebug ? vec4(1.0, 1.0, 1.0, troikaGlyphUvToSdfValue(vTroikaGlyphUV)) : gl_FragColor;
  
if (gl_FragColor.a == 0.0) {
  discard;
}
`


/**
 * Create a material for rendering text, derived from a baseMaterial
 */
export function createTextDerivedMaterial(baseMaterial) {
  const textMaterial = createDerivedMaterial(baseMaterial, {
    chained: true,
    extensions: {
      derivatives: true,
      fragDepth: true
    },
    uniforms: {
      uTroikaSDFTexture: {value: null},
      uTroikaSDFTextureSize: {value: new Vector2()},
      uTroikaSDFGlyphSize: {value: 0},
      uTroikaSDFExponent: {value: 0},
      uTroikaTotalBounds: {value: new Vector4(0,0,0,0)},
      uTroikaClipRect: {value: new Vector4(0,0,0,0)},
      uTroikaOutlineWidth: {value: 0},
      uTroikaOutlineColor: {value: new Color(0)},
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



