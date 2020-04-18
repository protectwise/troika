/**
 * Initializes and returns a function to generate an SDF texture for a given glyph.
 * @param {function} createGlyphSegmentsQuadtree - factory for a GlyphSegmentsQuadtree implementation.
 * @param {number} config.sdfTextureSize - the length of one side of the resulting texture image.
 *                 Larger images encode more details. Should be a power of 2.
 * @param {number} config.sdfDistancePercent - see docs for SDF_DISTANCE_PERCENT in TextBuilder.js
 *
 * @return {function(Object): {renderingBounds: [minX, minY, maxX, maxY], textureData: Uint8Array}}
 */
function createSDFGenerator(createGlyphSegmentsQuadtree, config) {
  const {
    sdfTextureSize,
    sdfDistancePercent
  } = config

  /**
   * How many straight line segments to use when approximating a glyph's quadratic/cubic bezier curves.
   */
  const CURVE_POINTS = 16

  const INF = Infinity

  /**
   * Find the point on a quadratic bezier curve at t where t is in the range [0, 1]
   */
  function pointOnQuadraticBezier(x0, y0, x1, y1, x2, y2, t) {
    const t2 = 1 - t
    return {
      x: t2 * t2 * x0 + 2 * t2 * t * x1 + t * t * x2,
      y: t2 * t2 * y0 + 2 * t2 * t * y1 + t * t * y2
    }
  }

  /**
   * Find the point on a cubic bezier curve at t where t is in the range [0, 1]
   */
  function pointOnCubicBezier(x0, y0, x1, y1, x2, y2, x3, y3, t) {
    const t2 = 1 - t
    return {
      x: t2 * t2 * t2 * x0 + 3 * t2 * t2 * t * x1 + 3 * t2 * t * t * x2 + t * t * t * x3,
      y: t2 * t2 * t2 * y0 + 3 * t2 * t2 * t * y1 + 3 * t2 * t * t * y2 + t * t * t * y3
    }
  }

  /**
   * Generate an SDF texture segment for a single glyph.
   * @param {object} glyphObj
   * @return {{textureData: Uint8Array, renderingBounds: *[]}}
   */
  function generateSDF(glyphObj) {
    //console.time('glyphSDF')

    const textureData = new Uint8Array(sdfTextureSize * sdfTextureSize)

    // Determine mapping between glyph grid coords and sdf grid coords
    const glyphW = glyphObj.xMax - glyphObj.xMin
    const glyphH = glyphObj.yMax - glyphObj.yMin

    // Choose a maximum distance radius in font units, based on the glyph's max dimensions
    const fontUnitsMaxDist = Math.max(glyphW, glyphH) * sdfDistancePercent

    // Use that, extending to the texture edges, to find conversion ratios between texture units and font units
    const fontUnitsPerXTexel = (glyphW + fontUnitsMaxDist * 2) / sdfTextureSize
    const fontUnitsPerYTexel = (glyphH + fontUnitsMaxDist * 2) / sdfTextureSize

    const textureMinFontX = glyphObj.xMin - fontUnitsMaxDist - fontUnitsPerXTexel
    const textureMinFontY = glyphObj.yMin - fontUnitsMaxDist - fontUnitsPerYTexel
    const textureMaxFontX = glyphObj.xMax + fontUnitsMaxDist + fontUnitsPerXTexel
    const textureMaxFontY = glyphObj.yMax + fontUnitsMaxDist + fontUnitsPerYTexel

    function textureXToFontX(x) {
      return textureMinFontX + (textureMaxFontX - textureMinFontX) * x / sdfTextureSize
    }

    function textureYToFontY(y) {
      return textureMinFontY + (textureMaxFontY - textureMinFontY) * y / sdfTextureSize
    }

    if (glyphObj.pathCommandCount) { //whitespace chars will have no commands, so we can skip all this
      // Decompose all paths into straight line segments and add them to a quadtree
      const lineSegmentsIndex = createGlyphSegmentsQuadtree(glyphObj)
      let firstX, firstY, prevX, prevY
      glyphObj.forEachPathCommand((type, x0, y0, x1, y1, x2, y2) => {
        switch (type) {
          case 'M':
            prevX = firstX = x0
            prevY = firstY = y0
            break
          case 'L':
            if (x0 !== prevX || y0 !== prevY) { //yup, some fonts have zero-length line commands
              lineSegmentsIndex.addLineSegment(prevX, prevY, (prevX = x0), (prevY = y0))
            }
            break
          case 'Q': {
            let prevPoint = {x: prevX, y: prevY}
            for (let i = 1; i < CURVE_POINTS; i++) {
              let nextPoint = pointOnQuadraticBezier(
                prevX, prevY,
                x0, y0,
                x1, y1,
                i / (CURVE_POINTS - 1)
              )
              lineSegmentsIndex.addLineSegment(prevPoint.x, prevPoint.y, nextPoint.x, nextPoint.y)
              prevPoint = nextPoint
            }
            prevX = x1
            prevY = y1
            break
          }
          case 'C': {
            let prevPoint = {x: prevX, y: prevY}
            for (let i = 1; i < CURVE_POINTS; i++) {
              let nextPoint = pointOnCubicBezier(
                prevX, prevY,
                x0, y0,
                x1, y1,
                x2, y2,
                i / (CURVE_POINTS - 1)
              )
              lineSegmentsIndex.addLineSegment(prevPoint.x, prevPoint.y, nextPoint.x, nextPoint.y)
              prevPoint = nextPoint
            }
            prevX = x2
            prevY = y2
            break
          }
          case 'Z':
            if (prevX !== firstX || prevY !== firstY) {
              lineSegmentsIndex.addLineSegment(prevX, prevY, firstX, firstY)
            }
            break
        }
      })

      // For each target SDF texel, find the distance from its center to its nearest line segment,
      // map that distance to an alpha value, and write that alpha to the texel
      for (let sdfX = 0; sdfX < sdfTextureSize; sdfX++) {
        for (let sdfY = 0; sdfY < sdfTextureSize; sdfY++) {
          const signedDist = lineSegmentsIndex.findNearestSignedDistance(
            textureXToFontX(sdfX + 0.5),
            textureYToFontY(sdfY + 0.5),
            fontUnitsMaxDist
          )
          //if (!isFinite(signedDist)) throw 'infinite distance!'
          let alpha = isFinite(signedDist) ? Math.round(255 * (1 + signedDist / fontUnitsMaxDist) * 0.5) : signedDist
          alpha = Math.max(0, Math.min(255, alpha)) //clamp
          textureData[sdfY * sdfTextureSize + sdfX] = alpha
        }
      }
    }

    //console.timeEnd('glyphSDF')

    return {
      textureData: textureData,

      renderingBounds: [
        textureMinFontX,
        textureMinFontY,
        textureMaxFontX,
        textureMaxFontY
      ]
    }
  }


  return generateSDF
}


export { createSDFGenerator }
