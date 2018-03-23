/**
 * Creates a self-contained environment for processing text rendering requests.
 *
 * It is important that this function has no external dependencies, so that it can be easily injected
 * into the source for a Worker without requiring a build step or complex dependency loading. Its sole
 * dependency, the `opentype` implementation object, must be passed in at initialization.
 *
 * @param {Object} opentype
 * @param {Object} config
 * @return {Object}
 */
export default function createFontProcessor(opentype, config) {

  const {
    defaultFontUrl,
    sdfTextureSize,
    sdfDistancePercent
  } = config


  /**
   * @private
   * Holds the loaded data for all fonts
   *
   * {
   *   fontUrl: {
   *     fontObj: {}, //opentype Font
   *     glyphs: {
   *       [glyphIndex]: {
   *         atlasIndex: 0,
   *         glyphObj: {}, //opentype Glyph
   *         renderingBounds: [x0, y0, x1, y1]
   *       },
   *       ...
   *     },
   *     glyphCount: 123
   *   }
   * }
   */
  const fonts = Object.create(null)


  /**
   * How many straight line segments to use when approximating a glyph's quadratic/cubic bezier curves.
   */
  const CURVE_POINTS = 16


  const INF = Infinity


  /**
   * Load a given font url
   */
  function doLoadFont(url, callback) {
    function tryLoad() {
      try {
        opentype.load(url, (err, font) => {
          if (err) {
            throw err
          } else {
            callback(font)
          }
        })
      } catch(err) {
        console.error(`Failure loading font ${url}${url === defaultFontUrl ? '' : '; trying fallback'}`, err)
        if (url !== defaultFontUrl) {
          url = defaultFontUrl
          tryLoad()
        }
      }
    }
    tryLoad()
  }


  /**
   * Load a given font url if needed, invoking a callback when it's loaded. If already
   * loaded, the callback will be called synchronously.
   */
  function loadFont(fontUrl, callback) {
    if (!fontUrl) fontUrl = defaultFontUrl
    let atlas = fonts[fontUrl]
    if (atlas) {
      // if currently loading font, add to callbacks, otherwise execute immediately
      if (atlas.onload) {
        atlas.onload.push(callback)
      } else {
        callback()
      }
    } else {
      const loadingAtlas = fonts[fontUrl] = {onload: [callback]}
      doLoadFont(fontUrl, fontObj => {
        atlas = fonts[fontUrl] = {
          fontObj: fontObj,
          glyphs: {},
          glyphCount: 0
        }
        loadingAtlas.onload.forEach(cb => cb())
      })
    }
  }


  /**
   * Get the atlas data for a given font url, loading it from the network and initializing
   * its atlas data objects if necessary.
   */
  function getSdfAtlas(fontUrl, callback) {
    if (!fontUrl) fontUrl = defaultFontUrl
    loadFont(fontUrl, () => {
      callback(fonts[fontUrl])
    })
  }


  /**
   * Main entry point.
   * Process a text string with given font and formatting parameters, and return all info
   * necessary to render all its glyphs.
   */
  function process(
    {
      text='',
      font=defaultFontUrl,
      fontSize=1,
      letterSpacing=0,
      lineHeight='normal',
      maxWidth=INF,
      textAlign='left',
      whiteSpace='normal',
      overflowWrap='normal',
      anchor
    },
    callback,
    metricsOnly=false
  ) {
    getSdfAtlas(font, atlas => {
      const fontObj = atlas.fontObj
      const hasMaxWidth = isFinite(maxWidth)
      let newGlyphs = null
      let glyphBounds = null
      let glyphIndices = null
      let totalBounds = null
      let lineCount = 0
      let maxLineWidth = 0
      let canWrap = whiteSpace !== 'nowrap'

      // Find conversion between native font units and fontSize units; this will already be done
      // for the gx/gy values below but everything else we'll need to convert
      const fontSizeMult = fontSize / fontObj.unitsPerEm

      // Determine appropriate value for 'normal' line height based on the font's actual metrics
      // TODO this does not guarantee individual glyphs won't exceed the line height, e.g. Roboto; should we use yMin/Max instead?
      if (lineHeight === 'normal') {
        lineHeight = (fontObj.ascender - fontObj.descender) / fontObj.unitsPerEm
      }

      // Determine line height and leading adjustments
      lineHeight = lineHeight * fontSize
      const halfLeading = (lineHeight - (fontObj.ascender - fontObj.descender) * fontSizeMult) / 2
      const otOpts = {
        kerning: true,
        features: {liga: true, rlig: true},
        letterSpacing
      }

      // Split by hard line breaks
      const lineBlocks = text.split(/\r?\n/).map(text => {
        let lineXOffset = 0

        // Distribute glyphs into lines based on wrapping
        let currentLine = []
        const lines = [currentLine]
        fontObj.forEachGlyph(text, 0, 0, fontSize, otOpts, (glyphObj, glyphX) => {
          const charCode = glyphObj.unicode
          const char = typeof charCode === 'number' && String.fromCharCode(charCode)
          const glyphWidth = glyphObj.advanceWidth * fontSizeMult
          const isWhitespace = !!char && /\s/.test(char)

          // If a non-whitespace character overflows the max width, we need to wrap
          if (canWrap && hasMaxWidth && !isWhitespace && glyphX + glyphWidth + lineXOffset > maxWidth && currentLine.length) {
            // If it's the first char after a whitespace, start a new line
            let nextLine
            if (currentLine[currentLine.length - 1].isWhitespace) {
              nextLine = []
              lineXOffset = -glyphX
            } else {
              // Back up looking for a whitespace character to wrap at
              for (let i = currentLine.length; i--;) {
                // If we got the start of the line there's no soft break point; make hard break if overflowWrap='break-word'
                if (i === 0 && overflowWrap==='break-word') {
                  nextLine = []
                  lineXOffset = -glyphX
                  break
                }
                // Found a soft break point; move all chars since it to a new line
                else if (currentLine[i].isWhitespace) {
                  nextLine = currentLine.splice(i + 1)
                  const adjustX = nextLine[0].x
                  lineXOffset -= adjustX
                  for (let j = 0; j < nextLine.length; j++) {
                    nextLine[j].x -= adjustX
                  }
                  break
                }
              }
            }
            if (nextLine) {
              // Strip any trailing whitespace characters from the prior line so they don't affect line length
              while (currentLine[currentLine.length - 1].isWhitespace) {
                currentLine.pop()
              }
              lines.push(currentLine = nextLine)
              maxLineWidth = maxWidth
            }
          }

          currentLine.push({
            glyphObj,
            x: glyphX + lineXOffset,
            y: 0, //added later
            width: glyphWidth,
            char: char,
            isWhitespace,
            isEmpty: glyphObj.xMin === glyphObj.xMax || glyphObj.yMin === glyphObj.yMax,
            atlasInfo: null //added later
          })
        })

        // Find max block width after wrapping
        for (let i = 0; i < lines.length && maxLineWidth < maxWidth; i++) {
          const lineGlyphs = lines[i]
          if (lineGlyphs.length) {
            const lastChar = lineGlyphs[lineGlyphs.length - 1]
            maxLineWidth = Math.max(maxLineWidth, lastChar.x + lastChar.width)
          }
        }
        lineCount += lines.length

        return lines
      })

      if (!metricsOnly) {
        // Process each line, applying alignment offsets, adding each glyph to the atlas, and
        // collecting all renderable glyphs into a single collection.
        const renderableGlyphs = []
        let lineYOffset = -(fontSize + halfLeading)
        lineBlocks.forEach(lines => {
          for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const lineGlyphs = lines[lineIndex]

            // Ignore empty lines
            if (lineGlyphs.length) {
              // Find x offset for horizontal alignment
              let lineXOffset = 0
              const lastChar = lineGlyphs[lineGlyphs.length - 1]
              const thisLineWidth = lastChar.x + lastChar.width
              let whitespaceCount = 0
              if (textAlign === 'center') {
                lineXOffset = (maxLineWidth - thisLineWidth) / 2
              } else if (textAlign === 'right') {
                lineXOffset = maxLineWidth - thisLineWidth
              } else if (textAlign === 'justify') {
                // just count the whitespace characters, and we'll adjust the offsets per character in the next loop
                for (let i = 0, len = lineGlyphs.length; i < len; i++) {
                  if (lineGlyphs[i].isWhitespace) {
                    whitespaceCount++
                  }
                }
              }

              for (let i = 0, len = lineGlyphs.length; i < len; i++) {
                const glyphInfo = lineGlyphs[i]
                if (glyphInfo.isWhitespace && textAlign === 'justify' && lineIndex !== lines.length - 1) {
                  lineXOffset += (maxLineWidth - thisLineWidth) / whitespaceCount
                }

                if (!glyphInfo.isWhitespace && !glyphInfo.isEmpty) {
                  const glyphObj = glyphInfo.glyphObj

                  // If we haven't seen this glyph yet, generate its SDF
                  let glyphAtlasInfo = atlas.glyphs[glyphObj.index]
                  if (!glyphAtlasInfo) {
                    const glyphSDFData = generateGlyphSDF(glyphObj)

                    // Assign this glyph the next available atlas index
                    glyphSDFData.atlasIndex = atlas.glyphCount++

                    // Queue it up in the response's newGlyphs list
                    if (!newGlyphs) newGlyphs = []
                    newGlyphs.push(glyphSDFData)

                    // Store its metadata (not the texture) in our atlas info
                    glyphAtlasInfo = atlas.glyphs[glyphObj.index] = {
                      atlasIndex: glyphSDFData.atlasIndex,
                      glyphObj: glyphObj,
                      renderingBounds: glyphSDFData.renderingBounds
                    }
                  }
                  glyphInfo.atlasInfo = glyphAtlasInfo

                  // Apply position adjustments
                  if (lineXOffset) glyphInfo.x += lineXOffset
                  glyphInfo.y = lineYOffset

                  renderableGlyphs.push(glyphInfo)
                }
              }
            }

            // Increment y offset for next line
            lineYOffset -= lineHeight
          }
        })

        // Find overall position adjustments for anchoring
        let anchorXOffset = 0
        let anchorYOffset = 0
        if (anchor) {
          // TODO allow string keywords?
          if (anchor[0]) {
            anchorXOffset = -maxLineWidth * anchor[0]
          }
          if (anchor[1]) {
            anchorYOffset = lineCount * lineHeight * anchor[1]
          }
        }

        // Create the final output for the rendeable glyphs
        glyphBounds = new Float32Array(renderableGlyphs.length * 4)
        glyphIndices = new Float32Array(renderableGlyphs.length)
        totalBounds = [INF, INF, -INF, -INF]
        renderableGlyphs.forEach((glyphInfo, i) => {
          const {renderingBounds, atlasIndex} = glyphInfo.atlasInfo
          const x0 = glyphBounds[i * 4] = glyphInfo.x + renderingBounds[0] * fontSizeMult + anchorXOffset
          const y0 = glyphBounds[i * 4 + 1] = glyphInfo.y + renderingBounds[1] * fontSizeMult + anchorYOffset
          const x1 = glyphBounds[i * 4 + 2] = glyphInfo.x + renderingBounds[2] * fontSizeMult + anchorXOffset
          const y1 = glyphBounds[i * 4 + 3] = glyphInfo.y + renderingBounds[3] * fontSizeMult + anchorYOffset

          if (x0 < totalBounds[0]) totalBounds[0] = x0
          if (y0 < totalBounds[1]) totalBounds[1] = y0
          if (x1 > totalBounds[2]) totalBounds[2] = x1
          if (y1 > totalBounds[3]) totalBounds[3] = y1

          glyphIndices[i] = atlasIndex
        })
      }

      callback({
        glyphBounds,
        glyphIndices,
        totalBounds,
        totalBlockSize: [maxLineWidth, lineCount * lineHeight],
        newGlyphSDFs: newGlyphs
      })
    })
  }


  /**
   * For a given text string and font parameters, determine the resulting block dimensions
   * after wrapping for the given maxWidth.
   * @param args
   * @param callback
   */
  function measure(args, callback) {
    process(args, (result) => {
      callback({
        width: result.totalBlockSize[0],
        height: result.totalBlockSize[1]
      })
    }, true)
  }


  /**
   * Generate an SDF texture segment for a single glyph.
   * @param {opentype.Glyph} glyphObj
   * @return {{textureData: Uint8Array, renderingBounds: *[]}}
   */
  function generateGlyphSDF(glyphObj) {
    //console.time('glyphSDF')

    const textureData = new Uint8Array(square(sdfTextureSize))

    // Determine mapping between glyph grid coords and sdf grid coords
    const glyphMetrics = glyphObj.getMetrics()
    const glyphW = glyphMetrics.xMax - glyphMetrics.xMin
    const glyphH = glyphMetrics.yMax - glyphMetrics.yMin

    // Choose a maximum distance radius in font units, based on the glyph's max dimensions
    const fontUnitsMaxDist = Math.max(glyphW, glyphH) * sdfDistancePercent

    // Use that, extending to the texture edges, to find conversion ratios between texture units and font units
    const fontUnitsPerXTexel = (glyphW + fontUnitsMaxDist * 2) / sdfTextureSize
    const fontUnitsPerYTexel = (glyphH + fontUnitsMaxDist * 2) / sdfTextureSize

    const textureMinFontX = glyphMetrics.xMin - fontUnitsMaxDist - fontUnitsPerXTexel
    const textureMinFontY = glyphMetrics.yMin - fontUnitsMaxDist - fontUnitsPerYTexel
    const textureMaxFontX = glyphMetrics.xMax + fontUnitsMaxDist + fontUnitsPerXTexel
    const textureMaxFontY = glyphMetrics.yMax + fontUnitsMaxDist + fontUnitsPerYTexel

    function textureXToFontX(x) {
      return textureMinFontX + (textureMaxFontX - textureMinFontX) * x / sdfTextureSize
    }

    function textureYToFontY(y) {
      return textureMinFontY + (textureMaxFontY - textureMinFontY) * y / sdfTextureSize
    }

    const commands = glyphObj.path.commands
    if (commands && commands.length) { //whitespace chars will have no commands, so we can skip all this
      // Decompose all paths into straight line segments and add them to a quadtree
      const lineSegmentsIndex = new GlyphSegmentsQuadtree(glyphMetrics)
      let firstX, firstY, prevX, prevY
      commands.forEach(cmd => {
        switch (cmd.type) {
          case 'M':
            prevX = firstX = cmd.x
            prevY = firstY = cmd.y
            break
          case 'L':
            if (cmd.x !== prevX || cmd.y !== prevY) { //yup, some fonts have zero-length line commands
              lineSegmentsIndex.addLineSegment(prevX, prevY, (prevX = cmd.x), (prevY = cmd.y))
            }
            break
          case 'Q': {
            let prevPoint = {x: prevX, y: prevY}
            for (let i = 1; i < CURVE_POINTS; i++) {
              let nextPoint = pointOnQuadraticBezier(
                prevX, prevY,
                cmd.x1, cmd.y1,
                cmd.x, cmd.y,
                i / (CURVE_POINTS - 1)
              )
              lineSegmentsIndex.addLineSegment(prevPoint.x, prevPoint.y, nextPoint.x, nextPoint.y)
              prevPoint = nextPoint
            }
            prevX = cmd.x
            prevY = cmd.y
            break
          }
          case 'C': {
            let prevPoint = {x: prevX, y: prevY}
            for (let i = 1; i < CURVE_POINTS; i++) {
              let nextPoint = pointOnCubicBezier(
                prevX, prevY,
                cmd.x1, cmd.y1,
                cmd.x2, cmd.y2,
                cmd.x, cmd.y,
              i / (CURVE_POINTS - 1)
              )
              lineSegmentsIndex.addLineSegment(prevPoint.x, prevPoint.y, nextPoint.x, nextPoint.y)
              prevPoint = nextPoint
            }
            prevX = cmd.x
            prevY = cmd.y
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
    constructor(glyphMetrics) {
      // Pick a good initial power-of-two bounding box that will hold all possible segments
      const {xMin, yMin, xMax, yMax} = glyphMetrics
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


  return {
    process,
    measure,
    loadFont
  }
}

