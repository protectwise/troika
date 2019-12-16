/**
 * Creates a self-contained environment for processing text rendering requests.
 *
 * It is important that this function has no external dependencies, so that it can be easily injected
 * into the source for a Worker without requiring a build step or complex dependency loading. Its sole
 * dependency, a `fontParser` implementation function, must be passed in at initialization.
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
export default function createFontProcessor(fontParser, sdfGenerator, config) {

  const {
    defaultFontUrl
  } = config


  /**
   * @private
   * Holds the loaded data for all fonts
   *
   * {
   *   fontUrl: {
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
      anchor,
      includeCaretPositions=false
    },
    callback,
    metricsOnly=false
  ) {
    // Ensure newlines are normalized
    if (text.indexOf('\r') > -1) {
      console.warn('FontProcessor.process: got text with \\r chars; normalizing to \\n')
      text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    }

    getSdfAtlas(font, atlas => {
      const fontObj = atlas.fontObj
      const hasMaxWidth = isFinite(maxWidth)
      let newGlyphs = null
      let glyphBounds = null
      let glyphAtlasIndices = null
      let caretPositions = null
      let totalBounds = null
      let maxLineWidth = 0
      let canWrap = whiteSpace !== 'nowrap'
      const {ascender, descender, unitsPerEm} = fontObj

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
      const caretHeight = Math.min(lineHeight, (ascender - descender) * fontSizeMult)
      const caretBottomOffset = (ascender + descender) / 2 * fontSizeMult - caretHeight / 2

      // Distribute glyphs into lines based on wrapping
      let lineXOffset = 0
      let currentLine = {glyphs: [], width: 0}
      const lines = [currentLine]
      fontObj.forEachGlyph(text, fontSize, letterSpacing, (glyphObj, glyphX, charIndex) => {
        const char = text.charAt(charIndex)
        const glyphWidth = glyphObj.advanceWidth * fontSizeMult
        const isWhitespace = !!char && /\s/.test(char)
        const curLineGlyphs = currentLine.glyphs
        let nextLineGlyphs

        // If a non-whitespace character overflows the max width, we need to soft-wrap
        if (canWrap && hasMaxWidth && !isWhitespace && glyphX + glyphWidth + lineXOffset > maxWidth && curLineGlyphs.length) {
          // If it's the first char after a whitespace, start a new line
          if (curLineGlyphs[curLineGlyphs.length - 1].isWhitespace) {
            nextLineGlyphs = []
            lineXOffset = -glyphX
          } else {
            // Back up looking for a whitespace character to wrap at
            for (let i = curLineGlyphs.length; i--;) {
              // If we got the start of the line there's no soft break point; make hard break if overflowWrap='break-word'
              if (i === 0 && overflowWrap === 'break-word') {
                nextLineGlyphs = []
                lineXOffset = -glyphX
                break
              }
              // Found a soft break point; move all chars since it to a new line
              else if (curLineGlyphs[i].isWhitespace) {
                nextLineGlyphs = curLineGlyphs.splice(i + 1)
                const adjustX = nextLineGlyphs[0].x
                lineXOffset -= adjustX
                for (let j = 0; j < nextLineGlyphs.length; j++) {
                  nextLineGlyphs[j].x -= adjustX
                }
                break
              }
            }
          }
          if (nextLineGlyphs) {
            currentLine.isSoftWrapped = true
            currentLine = {glyphs: nextLineGlyphs, width: 0}
            lines.push(currentLine)
            maxLineWidth = maxWidth //after soft wrapping use maxWidth as calculated width
          }
        }

        currentLine.glyphs.push({
          glyphObj,
          x: glyphX + lineXOffset,
          y: 0, //added later
          width: glyphWidth,
          char: char,
          charIndex,
          isWhitespace,
          isEmpty: glyphObj.xMin === glyphObj.xMax || glyphObj.yMin === glyphObj.yMax,
          atlasInfo: null //added later
        })

        // Handle hard line breaks
        if (char === '\n') {
          currentLine = {glyphs: [], width: 0}
          lines.push(currentLine)
          lineXOffset = -(glyphX + glyphWidth)
        }
      })

      // Calculate width of each line (excluding trailing whitespace) and maximum block width
      lines.forEach(line => {
        const lineGlyphs = line.glyphs
        for (let i = lineGlyphs.length; i--;) {
          const lastChar = lineGlyphs[i]
          if (!lastChar.isWhitespace) {
            line.width = lastChar.x + lastChar.width
            if (line.width > maxLineWidth) {
              maxLineWidth = line.width
            }
            return
          }
        }
      })

      if (!metricsOnly) {
        // Process each line, applying alignment offsets, adding each glyph to the atlas, and
        // collecting all renderable glyphs into a single collection.
        const renderableGlyphs = []
        let lineYOffset = -(fontSize + halfLeading)
        if (includeCaretPositions) {
          caretPositions = new Float32Array(text.length * 3)
        }
        let prevCharIndex = -1
        lines.forEach(line => {
          const {glyphs:lineGlyphs, width:lineWidth} = line

          // Ignore empty lines
          if (lineGlyphs.length) {
            // Find x offset for horizontal alignment
            let lineXOffset = 0
            let whitespaceCount = 0
            if (textAlign === 'center') {
              lineXOffset = (maxLineWidth - lineWidth) / 2
            } else if (textAlign === 'right') {
              lineXOffset = maxLineWidth - lineWidth
            } else if (textAlign === 'justify') {
              // just count the non-trailing whitespace characters, and we'll adjust the offsets per
              // character in the next loop
              for (let i = lineGlyphs.length; i--;) {
                if (!lineGlyphs[i].isWhitespace) {
                  while (i--) {
                    if (lineGlyphs[i].isWhitespace) {
                      whitespaceCount++
                    }
                  }
                  break
                }
              }
            }

            for (let i = 0, len = lineGlyphs.length; i < len; i++) {
              const glyphInfo = lineGlyphs[i]

              // Apply position adjustments
              if (lineXOffset) glyphInfo.x += lineXOffset
              glyphInfo.y = lineYOffset

              // Expand whitespaces for justify alignment
              if (glyphInfo.isWhitespace && textAlign === 'justify' && line.isSoftWrapped) {
                const adjust = (maxLineWidth - lineWidth) / whitespaceCount
                lineXOffset += adjust
                glyphInfo.width += adjust
              }

              // Add initial caret positions
              if (includeCaretPositions) {
                const {charIndex} = glyphInfo
                caretPositions[charIndex * 3] = glyphInfo.x //left edge x
                caretPositions[charIndex * 3 + 1] = glyphInfo.x + glyphInfo.width //right edge x
                caretPositions[charIndex * 3 + 2] = glyphInfo.y + caretBottomOffset //common bottom y

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

              // Get atlas data for renderable glyphs
              if (!glyphInfo.isWhitespace && !glyphInfo.isEmpty) {
                const glyphObj = glyphInfo.glyphObj

                // If we haven't seen this glyph yet, generate its SDF
                let glyphAtlasInfo = atlas.glyphs[glyphObj.index]
                if (!glyphAtlasInfo) {
                  const glyphSDFData = sdfGenerator(glyphObj)

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

                renderableGlyphs.push(glyphInfo)
              }
            }
          }

          // Increment y offset for next line
          lineYOffset -= lineHeight
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
            anchorYOffset = lines.length * lineHeight * anchor[1]
          }
        }

        // Adjust caret positions by anchoring offsets
        if (includeCaretPositions && (anchorXOffset || anchorYOffset)) {
          for (let i = 0, len = caretPositions.length; i < len; i += 3) {
            caretPositions[i] += anchorXOffset
            caretPositions[i + 1] += anchorXOffset
            caretPositions[i + 2] += anchorYOffset
          }
        }

        // Create the final output for the rendeable glyphs
        glyphBounds = new Float32Array(renderableGlyphs.length * 4)
        glyphAtlasIndices = new Float32Array(renderableGlyphs.length)
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

          glyphAtlasIndices[i] = atlasIndex
        })
      }

      callback({
        glyphBounds, //rendering quad bounds for each glyph [x1, y1, x2, y2]
        glyphAtlasIndices, //atlas indices for each glyph
        caretPositions, //x,y of bottom of cursor position before each char, plus one after last char
        caretHeight, //height of cursor from bottom to top
        totalBounds, //total rect including all glyphBounds; will be slightly larger than glyph edges due to SDF padding
        totalBlockSize: [maxLineWidth, lines.length * lineHeight], //width and height of the text block; accurate for layout measurement
        newGlyphSDFs: newGlyphs //if this request included any new SDFs for the atlas, they'll be included here
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

  return {
    process,
    measure,
    loadFont
  }
}

