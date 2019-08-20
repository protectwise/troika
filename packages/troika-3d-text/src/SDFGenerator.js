/**
 * Initializes and returns a function to generate an SDF texture for a given glyph.
 * @param {number} config.sdfTextureSize - the length of one side of the resulting texture image.
 *                 Larger images encode more details. Should be a power of 2.
 * @param {number} config.sdfDistancePercent - see docs for SDF_DISTANCE_PERCENT in TextBuilder.js
 *
 * @return {function(Object): {renderingBounds: [minX, minY, maxX, maxY], textureData: Uint8Array}}
 */
function createSDFGenerator(config) {
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
   * You're such a square.
   */
  function square(n) {
    return n * n
  }

  /**
   * Find the absolute distance from a point to a line segment at closest approach
   */
  function absDistanceToLineSegment(x, y, lineX0, lineY0, lineX1, lineY1) {
    const ldx = lineX1 - lineX0
    const ldy = lineY1 - lineY0
    const lengthSq = square(ldx) + square(ldy)
    const t = lengthSq ? Math.max(0, Math.min(1, ((x - lineX0) * ldx + (y - lineY0) * ldy) / lengthSq)) : 0
    return Math.sqrt(square(x - (lineX0 + t * ldx)) + square(y - (lineY0 + t * ldy)))
  }


  /**
   * Basic quadtree impl for performing fast spatial searches of a glyph's line segments
   */
  class GlyphSegmentsQuadtree {
    constructor(glyphObj) {
      // Pick a good initial power-of-two bounding box that will hold all possible segments
      const {xMin, yMin, xMax, yMax} = glyphObj
      const dx = xMax - xMin
      const dy = yMax - yMin
      const cx = Math.round(xMin + dx / 2)
      const cy = Math.round(yMin + dy / 2)
      const r = Math.pow(2, Math.floor(Math.log(Math.max(dx, dy)) * Math.LOG2E))

      this._root = {
        0: null,
        1: null,
        2: null,
        3: null,
        data: null,
        cx: cx,
        cy: cy,
        r: r,
        minX: INF,
        minY: INF,
        maxX: -INF,
        maxY: -INF
      }
    }

    addLineSegment(x0, y0, x1, y1) {
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2
      const segment = {
        x0, y0, x1, y1, cx, cy,
        minX: Math.min(x0, x1),
        minY: Math.min(y0, y1),
        maxX: Math.max(x0, x1),
        maxY: Math.max(y0, y1),
        next: null
      }
      this._insertSegment(segment, this._root)
    }

    _insertSegment(segment, node) {
      // update node min/max stats
      const {minX, minY, maxX, maxY, cx, cy} = segment
      if (minX < node.minX) node.minX = minX
      if (minY < node.minY) node.minY = minY
      if (maxX > node.maxX) node.maxX = maxX
      if (maxY > node.maxY) node.maxY = maxY

      // leaf
      let leafSegment = node.data
      if (leafSegment) {
        // coincident; push as linked list
        if (leafSegment.cx === cx && leafSegment.cy === cy) {
          while (leafSegment.next) leafSegment = leafSegment.next
          leafSegment.next = segment
        }
        // non-coincident; split leaf to branch
        else {
          node.data = null
          this._insertSegment(leafSegment, node)
          this._insertSegment(segment, node)
        }
      }
      // branch
      else {
        // find target sub-index for the segment's centerpoint
        const subIndex = (cy < node.cy ? 0 : 2) + (cx < node.cx ? 0 : 1)

        // subnode already at index: recurse
        if (node[subIndex]) {
          this._insertSegment(segment, node[subIndex])
        }
        // create new leaf
        else {
          node[subIndex] = {
            0: null,
            1: null,
            2: null,
            3: null,
            data: segment,
            cx: node.cx + node.r / 2 * (subIndex % 2 ? 1 : -1),
            cy: node.cy + node.r / 2 * (subIndex < 2 ? -1 : 1),
            r: node.r / 2,
            minX: minX,
            minY: minY,
            maxX: maxX,
            maxY: maxY
          }
        }
      }
    }

    walkTree(callback) {
      this.walkBranch(this._root, callback)
    }
    walkBranch(root, callback) {
      if (callback(root) !== false && !root.data) {
        for (let i = 0; i < 4; i++) {
          if (root[i] !== null) {
            this.walkBranch(root[i], callback)
          }
        }
      }
    }

    findNearestSignedDistance(x, y, maxSearchRadius) {
      let closestDist = maxSearchRadius

      this.walkTree(function visit(node) {
        // Ignore nodes that can't possibly have segments closer than what we've already found. We base
        // this on a simple rect bounds check; radial would be more accurate but much slower.
        if (
          x - closestDist > node.maxX || x + closestDist < node.minX ||
          y - closestDist > node.maxY || y + closestDist < node.minY
        ) {
          return false
        }

        // Leaf - check each segment's actual distance
        if (node.data) {
          for (let segment = node.data; segment; segment = segment.next) {
            if ( //fast prefilter for segment to avoid dist calc
              x - closestDist < segment.maxX || x + closestDist > segment.minX ||
              y - closestDist < segment.maxY || y + closestDist > segment.minY
            ) {
              const dist = absDistanceToLineSegment(x, y, segment.x0, segment.y0, segment.x1, segment.y1)
              if (dist < closestDist) {
                closestDist = dist
              }
            }
          }
        }
      })

      // Flip to negative distance if outside the poly
      if (!this.isPointInPoly(x, y)) {
        closestDist = -closestDist
      }
      return closestDist
    }

    isPointInPoly(x, y) {
      let inside = false
      this.walkTree(node => {
        // Ignore nodes whose bounds can't possibly cross our east-pointing ray
        if (node.maxX < x || node.minY > y || node.maxY < y) {
          return false
        }

        // Leaf - test each segment for whether it crosses our east-pointing ray
        if (node.data) {
          for (let segment = node.data; segment; segment = segment.next) {
            const {x0, y0, x1, y1} = segment
            const intersects = ((y0 > y) !== (y1 > y)) && (x < (x1 - x0) * (y - y0) / (y1 - y0) + x0)
            if (intersects) {
              inside = !inside
            }
          }
        }
      })
      return inside
    }
  }

  /**
   * Generate an SDF texture segment for a single glyph.
   * @param {object} glyphObj
   * @return {{textureData: Uint8Array, renderingBounds: *[]}}
   */
  function generateSDF(glyphObj) {
    //console.time('glyphSDF')

    const textureData = new Uint8Array(square(sdfTextureSize))

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
      const lineSegmentsIndex = new GlyphSegmentsQuadtree(glyphObj)
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


export default createSDFGenerator
