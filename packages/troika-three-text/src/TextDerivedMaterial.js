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
uniform float uTroikaDistanceOffset;
attribute vec4 aTroikaGlyphBounds;
attribute float aTroikaGlyphIndex;
attribute vec3 aTroikaGlyphColor;
varying vec2 vTroikaGlyphUV;
varying vec4 vTroikaTextureUVBounds;
varying vec3 vTroikaGlyphColor;
varying vec2 vTroikaGlyphDimensions;
`

// language=GLSL prefix="void main() {" suffix="}"
const VERTEX_TRANSFORM = `
vec4 bounds = aTroikaGlyphBounds;
vec4 outlineBounds = vec4(bounds.xy - uTroikaDistanceOffset, bounds.zw + uTroikaDistanceOffset);
vec4 clippedBounds = vec4(
  clamp(outlineBounds.xy, uTroikaClipRect.xy, uTroikaClipRect.zw),
  clamp(outlineBounds.zw, uTroikaClipRect.xy, uTroikaClipRect.zw)
);
vec2 clippedXY = (mix(clippedBounds.xy, clippedBounds.zw, position.xy) - bounds.xy) / (bounds.zw - bounds.xy);

position.xy = mix(bounds.xy, bounds.zw, clippedXY);

uv = (position.xy - uTroikaTotalBounds.xy) / (uTroikaTotalBounds.zw - uTroikaTotalBounds.xy);

position = uTroikaOrient * position;
normal = uTroikaOrient * normal;

vTroikaGlyphUV = clippedXY.xy;
vTroikaGlyphDimensions = vec2(bounds[2] - bounds[0], bounds[3] - bounds[1]);

${''/* NOTE: it seems important to calculate the glyph's bounding texture UVs here in the
  vertex shader, rather than in the fragment shader, as the latter gives strange artifacts
  on some glyphs (those in the leftmost texture column) on some systems. The exact reason
  isn't understood but doing this here, then mix()-ing in the fragment shader, seems to work. */}
float txCols = uTroikaSDFTextureSize.x / uTroikaSDFGlyphSize;
vec2 txUvPerGlyph = uTroikaSDFGlyphSize / uTroikaSDFTextureSize;
vec2 txStartUV = txUvPerGlyph * vec2(
  mod(aTroikaGlyphIndex, txCols),
  floor(aTroikaGlyphIndex / txCols)
);
vTroikaTextureUVBounds = vec4(txStartUV, vec2(txStartUV) + txUvPerGlyph);
`

// language=GLSL
const FRAGMENT_DEFS = `
uniform sampler2D uTroikaSDFTexture;
uniform vec2 uTroikaSDFTextureSize;
uniform float uTroikaSDFGlyphSize;
uniform float uTroikaSDFExponent;
uniform float uTroikaDistanceOffset;
uniform bool uTroikaSDFDebug;
varying vec2 vTroikaGlyphUV;
varying vec4 vTroikaTextureUVBounds;
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

float troikaGlyphUvToSdfValue(vec2 glyphUV) {
  vec2 textureUV = mix(vTroikaTextureUVBounds.xy, vTroikaTextureUVBounds.zw, glyphUV);
  return texture2D(uTroikaSDFTexture, textureUV).r;
}

float troikaGlyphUvToDistance(vec2 uv) {
  return troikaSdfValueToSignedDistance(troikaGlyphUvToSdfValue(uv));
}

float troikaGetTextAlpha(float distanceOffset) {
  vec2 clampedGlyphUV = clamp(vTroikaGlyphUV, 0.5 / uTroikaSDFGlyphSize, 1.0 - 0.5 / uTroikaSDFGlyphSize);
  float distance = troikaGlyphUvToDistance(clampedGlyphUV);
    
  // Extrapolate distance when outside bounds:
  distance += clampedGlyphUV == vTroikaGlyphUV ? 0.0 : 
    length((vTroikaGlyphUV - clampedGlyphUV) * vTroikaGlyphDimensions);

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
  
  #if defined(IS_DEPTH_MATERIAL) || defined(IS_DISTANCE_MATERIAL)
  float alpha = step(-distanceOffset, -distance);
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
  
  return alpha;
}
`

// language=GLSL prefix="void main() {" suffix="}"
const FRAGMENT_TRANSFORM = `
float alpha = uTroikaSDFDebug ?
  troikaGlyphUvToSdfValue(vTroikaGlyphUV) :
  troikaGetTextAlpha(uTroikaDistanceOffset);

#if !defined(IS_DEPTH_MATERIAL) && !defined(IS_DISTANCE_MATERIAL)
gl_FragColor.a *= alpha;
#endif
  
if (alpha == 0.0) {
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
      derivatives: true
    },
    uniforms: {
      uTroikaSDFTexture: {value: null},
      uTroikaSDFTextureSize: {value: new Vector2()},
      uTroikaSDFGlyphSize: {value: 0},
      uTroikaSDFExponent: {value: 0},
      uTroikaTotalBounds: {value: new Vector4(0,0,0,0)},
      uTroikaClipRect: {value: new Vector4(0,0,0,0)},
      uTroikaDistanceOffset: {value: 0},
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



