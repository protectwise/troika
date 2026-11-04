import { Color, Vector2, Vector4, Matrix3, Texture } from 'three'
import { texture, uniform, vec3, vec4, Fn, If, select, max, mix, smoothstep, materialColor,
  length, fwidth, mul, clamp, div, add, sub, attribute, positionLocal, vec2,
  mod, pow, Discard, normalLocal, sin, cos
} from "three/tsl";


const uTroikaSDFTexture = texture(new Texture()).setName("uTroikaSDFTexture");
const uTroikaSDFTextureSize = uniform(new Vector2()).setName("uTroikaSDFTextureSize");
const uTroikaSDFGlyphSize = uniform(0).setName("uTroikaSDFGlyphSize");
const uTroikaSDFExponent = uniform(0).setName("uTroikaSDFExponent");
const uTroikaTotalBounds = uniform(new Vector4(0,0,0,0)).setName("uTroikaTotalBounds");
const uTroikaClipRect = uniform(new Vector4(0,0,0,0)).setName("uTroikaClipRect");
const uTroikaEdgeOffset = uniform(0).setName("uTroikaEdgeOffset");
const uTroikaFillOpacity = uniform(1).setName("uTroikaFillOpacity");
const uTroikaPositionOffset = uniform(new Vector2()).setName("uTroikaPositionOffset");
const uTroikaCurveRadius = uniform(0).setName("uTroikaCurveRadius");
const uTroikaBlurRadius = uniform(0).setName("uTroikaBlurRadius");
const uTroikaStrokeWidth = uniform(0).setName("uTroikaStrokeWidth");
const uTroikaStrokeColor = uniform(new Color()).setName("uTroikaStrokeColor");
const uTroikaStrokeOpacity = uniform(1).setName("uTroikaStrokeOpacity");
const uTroikaOrient = uniform(new Matrix3()).setName("uTroikaOrient");
const uTroikaUseGlyphColors = uniform(true).setName("uTroikaUseGlyphColors");
const uTroikaSDFDebug = uniform(false).setName("uTroikaSDFDebug");

const aTroikaGlyphBounds = attribute("aTroikaGlyphBounds", "vec4").setName("aTroikaGlyphBounds");
const aTroikaGlyphIndex = attribute("aTroikaGlyphIndex", "int").setName("aTroikaGlyphIndex");
const aTroikaGlyphColor = attribute("aTroikaGlyphColor", "vec3").setName("aTroikaGlyphColor");

const bounds = vec4(
  add(aTroikaGlyphBounds.x, uTroikaPositionOffset.x),
  sub(aTroikaGlyphBounds.y, uTroikaPositionOffset.y),
  add(aTroikaGlyphBounds.z, uTroikaPositionOffset.x),
  sub(aTroikaGlyphBounds.w, uTroikaPositionOffset.y)).toVar("bounds");

const outlineBounds = vec4(
  bounds.xy.sub(uTroikaEdgeOffset).sub(uTroikaBlurRadius),
  bounds.zw.add(uTroikaEdgeOffset).add(uTroikaBlurRadius)
).toVar("outlineBounds");

const clippedBounds = vec4(
  clamp(outlineBounds.xy, uTroikaClipRect.xy, uTroikaClipRect.zw),
  clamp(outlineBounds.zw, uTroikaClipRect.xy, uTroikaClipRect.zw)
).toVar("clippedBounds");

const clippedXY = (mix(clippedBounds.xy, clippedBounds.zw, positionLocal.xy).sub(bounds.xy)).div(bounds.zw.sub(bounds.xy)).toVar("clippedXY");

const troikaSDFPosition = Fn(( { context }) => 
{
  let position = vec3(mix(bounds.xy, bounds.zw, clippedXY), 0);

  const uv = div(sub(position.xy, uTroikaTotalBounds.xy), sub(uTroikaTotalBounds.zw, uTroikaTotalBounds.xy));
  context.getUV = () => uv;

  let normal = normalLocal.toVar("_normal");

  const rad = uTroikaCurveRadius;
  If(rad.notEqual(0.0), () => {
    const angle = position.x.div(rad);
    position.x = sin(angle).mul(rad);
    position.z = sub(rad, cos(angle).mul(rad));
    normal.x = sin(angle);
    normal.z = cos(angle);
  });
    
  position.mulAssign(uTroikaOrient);
  positionLocal.assign(position);
  normal.mulAssign(uTroikaOrient);
  normalLocal.assign(normal);

  return position;
})();

const vTroikaGlyphUV = clippedXY.xy.toVarying("vTroikaGlyphUV");
const vTroikaGlyphDimensions = vec2(bounds.z.sub(bounds.x), bounds.w.sub(bounds.y)).toVarying("vTroikaGlyphDimensions");

/* NOTE: it seems important to calculate the glyph's bounding texture UVs here in the
  vertex shader, rather than in the fragment shader, as the latter gives strange artifacts
  on some glyphs (those in the leftmost texture column) on some systems. The exact reason
  isn't understood but doing this here, then mix()-ing in the fragment shader, seems to work. */
const txCols = uTroikaSDFTextureSize.x.div(uTroikaSDFGlyphSize).toVar("txCols");
const txUvPerSquare = uTroikaSDFGlyphSize.div(uTroikaSDFTextureSize).toVar("txUvPerSquare");
const txStartUV = txUvPerSquare.mul(vec2(
  mod(aTroikaGlyphIndex.div(4.0), txCols),
  aTroikaGlyphIndex.div(4.0).div(txCols)
)).toVar("txStartUV");
const vTroikaTextureUVBounds = vec4(txStartUV, vec2(txStartUV).add(txUvPerSquare)).toVarying("vTroikaTextureUVBounds");
const vTroikaTextureChannel = mod(aTroikaGlyphIndex, 4.0).toVarying("vTroikaTextureChannel");


const troikaSdfValueToSignedDistance = (alpha) => {
  // Inverse of exponential encoding in webgl-sdf-generator
  /* TODO - there's some slight inaccuracy here when dealing with interpolated alpha values; those
    are linearly interpolated where the encoding is exponential. Look into improving this by rounding
    to nearest 2 whole texels, decoding those exponential values, and linearly interpolating the result.
  */
  const maxDimension = max(vTroikaGlyphDimensions.x, vTroikaGlyphDimensions.y);
  const absDist = 
    sub(1.0,
      pow(
        mul(2.0,
          select(
            alpha.greaterThan(0.5),
            sub(1.0, alpha),
            alpha
          )
        ),
        div(1.0, uTroikaSDFExponent)
      )
    ).mul(maxDimension);
  const signedDist = absDist.mul(
    select(
      alpha.greaterThan(0.5),
      -1.0,
      1.0)
    );
  return signedDist.toVar("troikaSdfValueToSignedDistance");
}

const troikaGlyphUvToSdfValue = (glyphUV) => {
  const textureUV = mix(vTroikaTextureUVBounds.xy, vTroikaTextureUVBounds.zw, glyphUV);
  const rgba = uTroikaSDFTexture.context( { getUV: () => textureUV } ).toVar();
  const ch = vTroikaTextureChannel;
  return select(
    ch.equal(0.0),
    rgba.r,
    select(ch.equal(1.0), 
      rgba.g, 
      select(ch.equal(2.0),
        rgba.b,
        rgba.a
      )
    ));
}

const troikaGlyphUvToDistance = (uv) => {
  return troikaSdfValueToSignedDistance(troikaGlyphUvToSdfValue(uv)).toVar("troikaGlyphUvToDistance");
}

const troikaGetAADist = () => {
  /*
    When the standard derivatives extension is available, we choose an antialiasing alpha threshold based
    on the potential change in the SDF's alpha from this fragment to its neighbor. This strategy maximizes 
    readability and edge crispness at all sizes and screen resolutions.
  */
  return length(fwidth(mul(vTroikaGlyphUV, vTroikaGlyphDimensions))).mul(0.5)
    .toVar("troikaGetAADist");
}

const troikaGetFragDistValue = () => {
  const clampedGlyphUV = clamp(vTroikaGlyphUV, div(0.5, uTroikaSDFGlyphSize), sub(1.0, div(0.5, uTroikaSDFGlyphSize)));
  const distance = troikaGlyphUvToDistance(clampedGlyphUV);
 
  // Extrapolate distance when outside bounds:
  distance.addAssign(
    select(
      clampedGlyphUV.equal(vTroikaGlyphUV),
      0.0, 
      length(sub(vTroikaGlyphUV, clampedGlyphUV).mul(vTroikaGlyphDimensions))
    ));

  /* 
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
  */

  return distance.toVar("troikaGetFragDistValue");
}

const troikaGetEdgeAlpha = (distance, distanceOffset, aaDist) => {
  const alpha = smoothstep(
    distanceOffset.add(aaDist),
    distanceOffset.sub(aaDist),
    distance
  );

  return alpha.toVar("troikaGetEdgeAlpha");
}

const troikaSDF = Fn(({ baseNode }) => 
{

  const aaDist = troikaGetAADist();
  const fragDistance = troikaGetFragDistValue();
  const sdfValue = troikaGlyphUvToSdfValue(vTroikaGlyphUV).toVar("sdfValue");
  const _edgeAlpha = troikaGetEdgeAlpha(fragDistance, uTroikaEdgeOffset, max(aaDist, uTroikaBlurRadius)).toVar("_edgeAlpha");
  const edgeAlpha =
    select(uTroikaSDFDebug,
      sdfValue,
      _edgeAlpha
    )
  If(edgeAlpha.lessThanEqual(0), () => { Discard() });

  baseNode = baseNode.toVar("baseNode");

  baseNode = select(uTroikaUseGlyphColors,
    vec4(aTroikaGlyphColor.div(255.0), 1),
    baseNode
  );

  let fillRGBA = vec4(
    baseNode.rgb,
    baseNode.a.mul(uTroikaFillOpacity));
  const strokeRGBA =
    select(uTroikaStrokeWidth.equal(0.0),
      fillRGBA,
      vec4(uTroikaStrokeColor, uTroikaStrokeOpacity)
    ).toVar("strokeRGBA");
  fillRGBA = vec4(
    select(fillRGBA.a.equal(0.0),
      strokeRGBA.rgb,
      fillRGBA.rgb
    ), fillRGBA.a);

  let fragColor = mix(fillRGBA, strokeRGBA, smoothstep(
    uTroikaStrokeWidth.negate().sub(aaDist),
    uTroikaStrokeWidth.negate().add(aaDist),
    fragDistance
  ));
  fragColor = vec4(
    fragColor.rgb,
    mul(fragColor.a, edgeAlpha)
  );

  return fragColor.toVar("_fragColor");
});


/**
 * Create a material for rendering text, derived from a baseMaterial
 */
export function createTextDerivedNodeMaterial(baseMaterial) {
  const textMaterial = baseMaterial.clone();

  textMaterial.baseMaterial = baseMaterial;
  textMaterial.isDerivedMaterial = true;
  textMaterial.isDerivedFrom = function (testMaterial) {
    const base = this.baseMaterial
    return testMaterial === base || (base.isDerivedMaterial && base.isDerivedFrom(testMaterial)) || false
  };
  textMaterial.uniforms = {
      uTroikaSDFTexture,
      uTroikaSDFTextureSize,
      uTroikaSDFGlyphSize,
      uTroikaSDFExponent,
      uTroikaTotalBounds,
      uTroikaClipRect,
      uTroikaEdgeOffset,
      uTroikaFillOpacity,
      uTroikaPositionOffset,
      uTroikaCurveRadius,
      uTroikaBlurRadius,
      uTroikaStrokeWidth,
      uTroikaStrokeColor,
      uTroikaStrokeOpacity,
      uTroikaOrient,
      uTroikaUseGlyphColors,
      uTroikaSDFDebug
  };

  textMaterial.positionNode = troikaSDFPosition;

  const baseNode = textMaterial.colorNode ? textMaterial.colorNode : materialColor;
  textMaterial.colorNode = troikaSDF({ baseNode });

  // Force transparency - TODO is this reasonable?
  textMaterial.transparent = true

  // Force single draw call when double-sided
  textMaterial.forceSinglePass = true

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



