/**
 * @typedef {object} SDFGeneratorResult
 * @property {Uint8Array} textureData
 * @property {number} timing
 */

/**
 * Initializes and returns a function to generate an SDF texture for a given glyph.
 * @param {function} createGlyphSegmentsIndex - factory for a GlyphSegmentsIndex implementation.
 * @return {function(Object): SDFGeneratorResult}
 */
function createSDFGenerator(createGlyphSegmentsIndex) {

  /**
   * How many straight line segments to use when approximating a glyph's quadratic/cubic bezier curves.
   */
  const CURVE_POINTS = 16

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

  function now() {
    return (self.performance || Date).now()
  }

  /**
   * Generate an SDF texture segment for a single glyph.
   * @param {number} sdfWidth - width of the SDF texture in pixels
   * @param {number} sdfHeight - height of the SDF texture in pixels
   * @param {string} path - an SVG path string describing the glyph; should only contain commands: M/L/Q/C/Z.
   * @param {number[]} viewBox - [minX, minY, maxX, maxY] in font units aligning with the texture's edges
   * @param {number} maxDistance - the maximum distance from the glyph path in font units that will be encoded
   * @param {number} [sdfExponent] - specifies an exponent for encoding the SDF's distance values; higher exponents
   *        will give greater precision nearer the glyph's path.
   * @return {SDFGeneratorResult}
   */
  function generateSDF(sdfWidth, sdfHeight, path, viewBox, maxDistance, sdfExponent = 1) {
    const start = now()
    const textureData = new Uint8Array(sdfWidth * sdfHeight)

    const viewBoxWidth = viewBox[2] - viewBox[0]
    const viewBoxHeight = viewBox[3] - viewBox[1]

    // Decompose all paths into straight line segments and add them to an index
    const lineSegmentsIndex = createGlyphSegmentsIndex(viewBox)
    const segmentRE = /([MLQCZ])([^MLQCZ]*)/g
    let match, firstX, firstY, prevX, prevY
    while (match = segmentRE.exec(path)) {
      const args = match[2].replace(/^\s*|\s*$/g, '').split(/[,\s]+/).map(v => parseFloat(v))
      switch (match[1]) {
        case 'M':
          prevX = firstX = args[0]
          prevY = firstY = args[1]
          break
        case 'L':
          if (args[0] !== prevX || args[1] !== prevY) { //yup, some fonts have zero-length line commands
            lineSegmentsIndex.addLineSegment(prevX, prevY, (prevX = args[0]), (prevY = args[1]))
          }
          break
        case 'Q': {
          let prevPoint = {x: prevX, y: prevY}
          for (let i = 1; i < CURVE_POINTS; i++) {
            let nextPoint = pointOnQuadraticBezier(
              prevX, prevY,
              args[0], args[1],
              args[2], args[3],
              i / (CURVE_POINTS - 1)
            )
            lineSegmentsIndex.addLineSegment(prevPoint.x, prevPoint.y, nextPoint.x, nextPoint.y)
            prevPoint = nextPoint
          }
          prevX = args[2]
          prevY = args[3]
          break
        }
        case 'C': {
          let prevPoint = {x: prevX, y: prevY}
          for (let i = 1; i < CURVE_POINTS; i++) {
            let nextPoint = pointOnCubicBezier(
              prevX, prevY,
              args[0], args[1],
              args[2], args[3],
              args[4], args[5],
              i / (CURVE_POINTS - 1)
            )
            lineSegmentsIndex.addLineSegment(prevPoint.x, prevPoint.y, nextPoint.x, nextPoint.y)
            prevPoint = nextPoint
          }
          prevX = args[4]
          prevY = args[5]
          break
        }
        case 'Z':
          if (prevX !== firstX || prevY !== firstY) {
            lineSegmentsIndex.addLineSegment(prevX, prevY, firstX, firstY)
          }
          break
      }
    }

    // For each target SDF texel, find the distance from its center to its nearest line segment,
    // map that distance to an alpha value, and write that alpha to the texel
    for (let sdfX = 0; sdfX < sdfWidth; sdfX++) {
      for (let sdfY = 0; sdfY < sdfHeight; sdfY++) {
        const signedDist = lineSegmentsIndex.findNearestSignedDistance(
          viewBox[0] + viewBoxWidth * (sdfX + 0.5) / sdfWidth,
          viewBox[1] + viewBoxHeight * (sdfY + 0.5) / sdfHeight,
          maxDistance
        )

        // Use an exponential scale to ensure the texels very near the glyph path have adequate
        // precision, while allowing the distance field to cover the entire texture, given that
        // there are only 8 bits available. Formula visualized: https://www.desmos.com/calculator/uiaq5aqiam
        let alpha = Math.pow((1 - Math.abs(signedDist) / maxDistance), sdfExponent) / 2
        if (signedDist < 0) {
          alpha = 1 - alpha
        }

        alpha = Math.max(0, Math.min(255, Math.round(alpha * 255))) //clamp
        textureData[sdfY * sdfWidth + sdfX] = alpha
      }
    }

    return {
      textureData,
      timing: now() - start
    }
  }

  return generateSDF
}


export { createSDFGenerator }
