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
 *         unicode: number,
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
          try {
            const fontObj = fontParser(request.response)
            callback(fontObj)
          } catch (e) {
            onError(e)
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

      // Split by hard line breaks
      const lineBlocks = text.split(/\r?\n/).map(text => {
        let lineXOffset = 0

        // Distribute glyphs into lines based on wrapping
        let currentLine = []
        const lines = [currentLine]
        fontObj.forEachGlyph(text, fontSize, letterSpacing, (glyphObj, glyphX) => {
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

  return {
    process,
    measure,
    loadFont
  }
}

