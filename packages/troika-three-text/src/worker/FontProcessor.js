/**
 * Creates a self-contained environment for processing text rendering requests.
 *
 * It is important that this function has no closure dependencies, so that it can be easily injected
 * into the source for a Worker without requiring a build step or complex dependency loading. All its
 * dependencies must be passed in at initialization.
 *
 * @param {function} fontParser - a function that accepts an ArrayBuffer of the font data and returns
 * a standardized structure giving access to the font and its glyphs:
 *   {
 *     unitsPerEm: number,
 *     ascender: number,
 *     descender: number,
 *     forEachGlyph(string, fontSize, letterSpacing, callback) {
 *       //invokes callback for each glyph to render, passing it an object:
 *       callback({
 *         index: number,
 *         advanceWidth: number,
 *         xMin: number,
 *         yMin: number,
 *         xMax: number,
 *         yMax: number,
 *         pathCommandCount: number,
 *         forEachPathCommand(callback) {
 *           //invokes callback for each path command, with args:
 *           callback(
 *             type: 'M|L|C|Q|Z',
 *             ...args //0 to 6 args depending on the type
 *           )
 *         }
 *       })
 *     }
 *   }
 * @param {function} sdfGenerator - a function that accepts a glyph object and generates an SDF texture
 * from it.
 * @param {Object} config
 * @return {Object}
 */
export function createFontProcessor(fontParser, sdfGenerator, config) {

  const {
    defaultFontUrl
  } = config


  /**
   * @private
   * Holds data about font glyphs and how they relate to SDF atlases
   *
   * {
   *   'fontUrl@sdfSize': {
   *     fontObj: {}, //result of the fontParser
   *     glyphs: {
   *       [glyphIndex]: {
   *         atlasIndex: 0,
   *         glyphObj: {}, //glyph object from the fontParser
   *         renderingBounds: [x0, y0, x1, y1]
   *       },
   *       ...
   *     },
   *     glyphCount: 123
   *   }
   * }
   */
  const fontAtlases = Object.create(null)

  /**
   * Holds parsed font objects by url
   */
  const fonts = Object.create(null)

  const INF = Infinity


  /**
   * Load a given font url
   */
  function doLoadFont(url, callback) {
    function tryLoad() {
      const onError = err => {
        console.error(`Failure loading font ${url}${url === defaultFontUrl ? '' : '; trying fallback'}`, err)
        if (url !== defaultFontUrl) {
          url = defaultFontUrl
          tryLoad()
        }
      }
      try {
        const request = new XMLHttpRequest()
        request.open('get', url, true)
        request.responseType = 'arraybuffer'
        request.onload = function () {
          if (request.status >= 400) {
            onError(new Error(request.statusText))
          }
          else if (request.status > 0) {
            try {
              const fontObj = fontParser(request.response)
              callback(fontObj)
            } catch (e) {
              onError(e)
            }
          }
        }
        request.onerror = onError
        request.send()
      } catch(err) {
        onError(err)
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
    let font = fonts[fontUrl]
    if (font) {
      // if currently loading font, add to callbacks, otherwise execute immediately
      if (font.pending) {
        font.pending.push(callback)
      } else {
        callback(font)
      }
    } else {
      fonts[fontUrl] = {pending: [callback]}
      doLoadFont(fontUrl, fontObj => {
        let callbacks = fonts[fontUrl].pending
        fonts[fontUrl] = fontObj
        callbacks.forEach(cb => cb(fontObj))
      })
    }
  }


  /**
   * Get the atlas data for a given font url, loading it from the network and initializing
   * its atlas data objects if necessary.
   */
  function getSdfAtlas(fontUrl, sdfGlyphSize, callback) {
    if (!fontUrl) fontUrl = defaultFontUrl
    let atlasKey = `${fontUrl}@${sdfGlyphSize}`
    let atlas = fontAtlases[atlasKey]
    if (atlas) {
      callback(atlas)
    } else {
      loadFont(fontUrl, fontObj => {
        atlas = fontAtlases[atlasKey] || (fontAtlases[atlasKey] = {
          fontObj: fontObj,
          glyphs: {},
          glyphCount: 0
        })
        callback(atlas)
      })
    }
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
      sdfGlyphSize=64,
      fontSize=1,
      letterSpacing=0,
      lineHeight='normal',
      maxWidth=INF,
      textAlign='left',
      textIndent=0,
      whiteSpace='normal',
      overflowWrap='normal',
      anchorX = 0,
      anchorY = 0,
      includeCaretPositions=false,
      chunkedBoundsSize=8192,
      colorRanges=null
    },
    callback,
    metricsOnly=false
  ) {
    const mainStart = now()
    const timings = {total: 0, fontLoad: 0, layout: 0, sdf: {}, sdfTotal: 0}

    // Ensure newlines are normalized
    if (text.indexOf('\r') > -1) {
      console.warn('FontProcessor.process: got text with \\r chars; normalizing to \\n')
      text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    }

    // Ensure we've got numbers not strings
    fontSize = +fontSize
    letterSpacing = +letterSpacing
    maxWidth = +maxWidth
    lineHeight = lineHeight || 'normal'
    textIndent = +textIndent

    getSdfAtlas(font, sdfGlyphSize, atlas => {
      const fontObj = atlas.fontObj
      const hasMaxWidth = isFinite(maxWidth)
      let newGlyphs = null
      let glyphBounds = null
      let glyphAtlasIndices = null
      let glyphColors = null
      let caretPositions = null
      let totalBounds = null
      let chunkedBounds = null
      let maxLineWidth = 0
      let renderableGlyphCount = 0
      let canWrap = whiteSpace !== 'nowrap'
      const {ascender, descender, unitsPerEm} = fontObj
      timings.fontLoad = now() - mainStart
      const layoutStart = now()

      // Find conversion between native font units and fontSize units; this will already be done
      // for the gx/gy values below but everything else we'll need to convert
      const fontSizeMult = fontSize / unitsPerEm

      // Determine appropriate value for 'normal' line height based on the font's actual metrics
      // TODO this does not guarantee individual glyphs won't exceed the line height, e.g. Roboto; should we use yMin/Max instead?
      if (lineHeight === 'normal') {
        lineHeight = (ascender - descender) / unitsPerEm
      }

      // Determine line height and leading adjustments
      lineHeight = lineHeight * fontSize
      const halfLeading = (lineHeight - (ascender - descender) * fontSizeMult) / 2
      const topBaseline = -(fontSize + halfLeading)
      const caretHeight = Math.min(lineHeight, (ascender - descender) * fontSizeMult)
      const caretBottomOffset = (ascender + descender) / 2 * fontSizeMult - caretHeight / 2

      // Distribute glyphs into lines based on wrapping
      let lineXOffset = textIndent
      let currentLine = new TextLine()
      const lines = [currentLine]
      fontObj.forEachGlyph(text, fontSize, letterSpacing, (glyphObj, glyphX, charIndex) => {
        const char = text.charAt(charIndex)
        const glyphWidth = glyphObj.advanceWidth * fontSizeMult
        const curLineCount = currentLine.count
        let nextLine

        // Calc isWhitespace and isEmpty once per glyphObj
        if (!('isEmpty' in glyphObj)) {
          glyphObj.isWhitespace = !!char && /\s/.test(char)
          glyphObj.isEmpty = glyphObj.xMin === glyphObj.xMax || glyphObj.yMin === glyphObj.yMax
        }
        if (!glyphObj.isWhitespace && !glyphObj.isEmpty) {
          renderableGlyphCount++
        }

        // If a non-whitespace character overflows the max width, we need to soft-wrap
        if (canWrap && hasMaxWidth && !glyphObj.isWhitespace && glyphX + glyphWidth + lineXOffset > maxWidth && curLineCount) {
          // If it's the first char after a whitespace, start a new line
          if (currentLine.glyphAt(curLineCount - 1).glyphObj.isWhitespace) {
            nextLine = new TextLine()
            lineXOffset = -glyphX
          } else {
            // Back up looking for a whitespace character to wrap at
            for (let i = curLineCount; i--;) {
              // If we got the start of the line there's no soft break point; make hard break if overflowWrap='break-word'
              if (i === 0 && overflowWrap === 'break-word') {
                nextLine = new TextLine()
                lineXOffset = -glyphX
                break
              }
              // Found a soft break point; move all chars since it to a new line
              else if (currentLine.glyphAt(i).glyphObj.isWhitespace) {
                nextLine = currentLine.splitAt(i + 1)
                const adjustX = nextLine.glyphAt(0).x
                lineXOffset -= adjustX
                for (let j = nextLine.count; j--;) {
                  nextLine.glyphAt(j).x -= adjustX
                }
                break
              }
            }
          }
          if (nextLine) {
            currentLine.isSoftWrapped = true
            currentLine = nextLine
            lines.push(currentLine)
            maxLineWidth = maxWidth //after soft wrapping use maxWidth as calculated width
          }
        }

        let fly = currentLine.glyphAt(currentLine.count)
        fly.glyphObj = glyphObj
        fly.x = glyphX + lineXOffset
        fly.width = glyphWidth
        fly.charIndex = charIndex

        // Handle hard line breaks
        if (char === '\n') {
          currentLine = new TextLine()
          lines.push(currentLine)
          lineXOffset = -(glyphX + glyphWidth + (letterSpacing * fontSize)) + textIndent
        }
      })

      // Calculate width of each line (excluding trailing whitespace) and maximum block width
      lines.forEach(line => {
        for (let i = line.count; i--;) {
          let {glyphObj, x, width} = line.glyphAt(i)
          if (!glyphObj.isWhitespace) {
            line.width = x + width
            if (line.width > maxLineWidth) {
              maxLineWidth = line.width
            }
            return
          }
        }
      })

      if (!metricsOnly) {
        // Find overall position adjustments for anchoring
        let anchorXOffset = 0
        let anchorYOffset = 0
        if (anchorX) {
          if (typeof anchorX === 'number') {
            anchorXOffset = -anchorX
          }
          else if (typeof anchorX === 'string') {
            anchorXOffset = -maxLineWidth * (
              anchorX === 'left' ? 0 :
              anchorX === 'center' ? 0.5 :
              anchorX === 'right' ? 1 :
              parsePercent(anchorX)
            )
          }
        }
        if (anchorY) {
          if (typeof anchorY === 'number') {
            anchorYOffset = -anchorY
          }
          else if (typeof anchorY === 'string') {
            let height = lines.length * lineHeight
            anchorYOffset = anchorY === 'top' ? 0 :
              anchorY === 'top-baseline' ? -topBaseline :
              anchorY === 'middle' ? height / 2 :
              anchorY === 'bottom' ? height :
              anchorY === 'bottom-baseline' ? height - halfLeading + descender * fontSizeMult :
              parsePercent(anchorY) * height
          }
        }

        // Process each line, applying alignment offsets, adding each glyph to the atlas, and
        // collecting all renderable glyphs into a single collection.
        glyphBounds = new Float32Array(renderableGlyphCount * 4)
        glyphAtlasIndices = new Float32Array(renderableGlyphCount)
        totalBounds = [INF, INF, -INF, -INF]
        chunkedBounds = []
        let lineYOffset = topBaseline
        if (includeCaretPositions) {
          caretPositions = new Float32Array(text.length * 3)
        }
        if (colorRanges) {
          glyphColors = new Uint8Array(renderableGlyphCount * 3)
        }
        let renderableGlyphIndex = 0
        let prevCharIndex = -1
        let colorCharIndex = -1
        let chunk
        let currentColor
        lines.forEach(line => {
          const {count:lineGlyphCount, width:lineWidth} = line

          // Ignore empty lines
          if (lineGlyphCount > 0) {
            // Find x offset for horizontal alignment
            let lineXOffset = 0
            let justifyAdjust = 0
            if (textAlign === 'center') {
              lineXOffset = (maxLineWidth - lineWidth) / 2
            } else if (textAlign === 'right') {
              lineXOffset = maxLineWidth - lineWidth
            } else if (textAlign === 'justify' && line.isSoftWrapped) {
              // just count the non-trailing whitespace characters, and we'll adjust the offsets per
              // character in the next loop
              let whitespaceCount = 0
              for (let i = lineGlyphCount; i--;) {
                if (!line.glyphAt(i).glyphObj.isWhitespace) {
                  while (i--) {
                    if (!line.glyphAt(i).glyphObj) {
                      debugger
                    }
                    if (line.glyphAt(i).glyphObj.isWhitespace) {
                      whitespaceCount++
                    }
                  }
                  break
                }
              }
              justifyAdjust = (maxLineWidth - lineWidth) / whitespaceCount
            }

            for (let i = 0; i < lineGlyphCount; i++) {
              const glyphInfo = line.glyphAt(i)
              const glyphObj = glyphInfo.glyphObj

              // Apply position adjustments
              if (lineXOffset) glyphInfo.x += lineXOffset

              // Expand whitespaces for justify alignment
              if (justifyAdjust !== 0 && glyphObj.isWhitespace) {
                lineXOffset += justifyAdjust
                glyphInfo.width += justifyAdjust
              }

              // Add caret positions
              if (includeCaretPositions) {
                const {charIndex} = glyphInfo
                caretPositions[charIndex * 3] = glyphInfo.x + anchorXOffset //left edge x
                caretPositions[charIndex * 3 + 1] = glyphInfo.x + glyphInfo.width + anchorXOffset //right edge x
                caretPositions[charIndex * 3 + 2] = lineYOffset + caretBottomOffset + anchorYOffset //common bottom y

                // If we skipped any chars from the previous glyph (due to ligature subs), copy the
                // previous glyph's info to those missing char indices. In the future we may try to
                // use the font's LigatureCaretList table to get interior caret positions.
                while (charIndex - prevCharIndex > 1) {
                  caretPositions[(prevCharIndex + 1) * 3] = caretPositions[prevCharIndex * 3 + 1]
                  caretPositions[(prevCharIndex + 1) * 3 + 1] = caretPositions[prevCharIndex * 3 + 1]
                  caretPositions[(prevCharIndex + 1) * 3 + 2] = caretPositions[prevCharIndex * 3 + 2]
                  prevCharIndex++
                }
                prevCharIndex = charIndex
              }

              // Track current color range
              if (colorRanges) {
                const {charIndex} = glyphInfo
                while(charIndex > colorCharIndex) {
                  colorCharIndex++
                  if (colorRanges.hasOwnProperty(colorCharIndex)) {
                    currentColor = colorRanges[colorCharIndex]
                  }
                }
              }

              // Get atlas data for renderable glyphs
              if (!glyphObj.isWhitespace && !glyphObj.isEmpty) {
                const idx = renderableGlyphIndex++

                // If we haven't seen this glyph yet, generate its SDF
                let glyphAtlasInfo = atlas.glyphs[glyphObj.index]
                if (!glyphAtlasInfo) {
                  const sdfStart = now()
                  const glyphSDFData = sdfGenerator(glyphObj, sdfGlyphSize)
                  timings.sdf[text.charAt(glyphInfo.charIndex)] = now() - sdfStart

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

                // Determine final glyph bounds and add them to the glyphBounds array
                const bounds = glyphAtlasInfo.renderingBounds
                const start = idx * 4
                const x0 = glyphBounds[start] = glyphInfo.x + bounds[0] * fontSizeMult + anchorXOffset
                const y0 = glyphBounds[start + 1] = lineYOffset + bounds[1] * fontSizeMult + anchorYOffset
                const x1 = glyphBounds[start + 2] = glyphInfo.x + bounds[2] * fontSizeMult + anchorXOffset
                const y1 = glyphBounds[start + 3] = lineYOffset + bounds[3] * fontSizeMult + anchorYOffset

                // Track total bounds
                if (x0 < totalBounds[0]) totalBounds[0] = x0
                if (y0 < totalBounds[1]) totalBounds[1] = y0
                if (x1 > totalBounds[2]) totalBounds[2] = x1
                if (y1 > totalBounds[3]) totalBounds[3] = y1

                // Track bounding rects for each chunk of N glyphs
                if (idx % chunkedBoundsSize === 0) {
                  chunk = {start: idx, end: idx, rect: [INF, INF, -INF, -INF]}
                  chunkedBounds.push(chunk)
                }
                chunk.end++
                if (x0 < chunk.rect[0]) chunk.rect[0] = x0
                if (y0 < chunk.rect[1]) chunk.rect[1] = y0
                if (x1 > chunk.rect[2]) chunk.rect[2] = x1
                if (y1 > chunk.rect[3]) chunk.rect[3] = y1

                // Add to atlas indices array
                glyphAtlasIndices[idx] = glyphAtlasInfo.atlasIndex

                // Add colors
                if (colorRanges) {
                  const start = idx * 3
                  glyphColors[start] = currentColor >> 16 & 255
                  glyphColors[start + 1] = currentColor >> 8 & 255
                  glyphColors[start + 2] = currentColor & 255
                }
              }
            }
          }

          // Increment y offset for next line
          lineYOffset -= lineHeight
        })
      }

      // Timing stats
      for (let ch in timings.sdf) {
        timings.sdfTotal += timings.sdf[ch]
      }
      timings.layout = now() - layoutStart - timings.sdfTotal
      timings.total = now() - mainStart

      callback({
        glyphBounds, //rendering quad bounds for each glyph [x1, y1, x2, y2]
        glyphAtlasIndices, //atlas indices for each glyph
        caretPositions, //x,y of bottom of cursor position before each char, plus one after last char
        caretHeight, //height of cursor from bottom to top
        glyphColors, //color for each glyph, if color ranges supplied
        chunkedBounds, //total rects per (n=chunkedBoundsSize) consecutive glyphs
        ascender: ascender * fontSizeMult, //font ascender
        descender: descender * fontSizeMult, //font descender
        lineHeight, //computed line height
        topBaseline, //y coordinate of the top line's baseline
        totalBounds, //total rect including all glyphBounds; will be slightly larger than glyph edges due to SDF padding
        totalBlockSize: [maxLineWidth, lines.length * lineHeight], //width and height of the text block; accurate for layout measurement
        newGlyphSDFs: newGlyphs, //if this request included any new SDFs for the atlas, they'll be included here
        timings
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
    }, {metricsOnly: true})
  }

  function parsePercent(str) {
    let match = str.match(/^([\d.]+)%$/)
    let pct = match ? parseFloat(match[1]) : NaN
    return isNaN(pct) ? 0 : pct / 100
  }

  function now() {
    return (self.performance || Date).now()
  }

  // Array-backed structure for a single line's glyphs data
  function TextLine() {
    this.data = []
  }
  TextLine.prototype = {
    width: 0,
    isSoftWrapped: false,
    get count() {
      return Math.ceil(this.data.length / 4)
    },
    glyphAt(i) {
      let fly = TextLine.flyweight
      fly.data = this.data
      fly.index = i
      return fly
    },
    splitAt(i) {
      let newLine = new TextLine()
      newLine.data = this.data.splice(i * 4)
      return newLine
    }
  }
  TextLine.flyweight = ['glyphObj', 'x', 'width', 'charIndex'].reduce((obj, prop, i, all) => {
    Object.defineProperty(obj, prop, {
      get() {
        return this.data[this.index * 4 + i]
      },
      set(val) {
        this.data[this.index * 4 + i] = val
      }
    })
    return obj
  }, {data: null, index: 0})


  return {
    process,
    measure,
    loadFont
  }
}

