import { Color, DataTexture, LinearFilter, LuminanceFormat } from 'three'
import { defineWorkerModule, ThenableWorkerModule } from 'troika-worker-utils'
import { createSDFGenerator } from './SDFGenerator.js'
import { createFontProcessor } from './FontProcessor.js'
import { createGlyphSegmentsQuadtree } from './GlyphSegmentsQuadtree'

// Choose parser impl:
import fontParser from './FontParser_Typr.js'
//import fontParser from './FontParser_OpenType.js'


const CONFIG = {
  defaultFontURL: 'https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxM.woff', //Roboto Regular
  sdfGlyphSize: 64,
  textureWidth: 2048
}
const tempColor = new Color()
let hasRequested = false

/**
 * Customizes the text builder configuration. This must be called prior to the first font processing
 * request, and applies to all fonts.
 *
 * @param {String} config.defaultFontURL - The URL of the default font to use for text processing
 *                 requests, in case none is specified or the specifiede font fails to load or parse.
 *                 Defaults to "Roboto Regular" from Google Fonts.
 * @param {Number} config.sdfGlyphSize - The size of each glyph's SDF (signed distance field) texture
 *                 that is used for rendering. Must be a power-of-two number, and applies to all fonts.
 *                 Larger sizes can improve the quality of glyph rendering by increasing the sharpness
 *                 of corners and preventing loss of very thin lines, at the expense of memory. Defaults
 *                 to 64 which is generally a good balance of size and quality.
 * @param {Number} config.textureWidth - The width of the SDF texture; must be a power of 2. Defaults to
 *                 2048 which is a safe maximum texture dimension according to the stats at
 *                 https://webglstats.com/webgl/parameter/MAX_TEXTURE_SIZE and should allow for a
 *                 reasonably large number of glyphs (default glyph size of 64 and safe texture size of
 *                 2048^2 allows for 1024 glyphs.) This can be increased if you need to increase the
 *                 glyph size and/or have an extraordinary number of glyphs.
 */
function configureTextBuilder(config) {
  if (hasRequested) {
    console.warn('configureTextBuilder called after first font request; will be ignored.')
  } else {
    assign(CONFIG, config)
  }
}


/**
 * The radial distance from glyph edges over which the SDF alpha will be calculated; if the alpha
 * at distance:0 is 0.5, then the alpha at this distance will be zero. This is defined as a percentage
 * of each glyph's maximum dimension in font space units so that it maps to the same minimum number of
 * SDF texels regardless of the glyph's size. A larger value provides greater alpha gradient resolution
 * and improves readability/antialiasing quality at small display sizes, but also decreases the number
 * of texels available for encoding path details.
 */
const SDF_DISTANCE_PERCENT = 1 / 8


/**
 * Repository for all font SDF atlas textures
 *
 *   {
 *     [font]: {
 *       sdfTexture: DataTexture
 *     }
 *   }
 */
const atlases = Object.create(null)

/**
 * @typedef {object} TroikaTextRenderInfo - Format of the result from `getTextRenderInfo`.
 * @property {object} parameters - The normalized input arguments to the render call.
 * @property {DataTexture} sdfTexture - The SDF atlas texture.
 * @property {number} sdfGlyphSize - See `configureTextBuilder#config.sdfGlyphSize`
 * @property {number} sdfMinDistancePercent - See `SDF_DISTANCE_PERCENT`
 * @property {Float32Array} glyphBounds - List of [minX, minY, maxX, maxY] quad bounds for each glyph.
 * @property {Float32Array} glyphAtlasIndices - List holding each glyph's index in the SDF atlas.
 * @property {Uint8Array} [glyphColors] - List holding each glyph's [r, g, b] color, if `colorRanges` was supplied.
 * @property {Float32Array} [caretPositions] - A list of caret positions for all glyphs; this is
 *           the bottom [x,y] of the cursor position before each char, plus one after the last char.
 * @property {number} [caretHeight] - An appropriate height for all selection carets.
 * @property {number} ascender - The font's ascender metric.
 * @property {number} descender - The font's descender metric.
 * @property {number} lineHeight - The final computed lineHeight measurement.
 * @property {number} topBaseline - The y position of the top line's baseline.
 * @property {Array<number>} totalBounds - The total [minX, minY, maxX, maxY] rect including all glyph
 *           quad bounds; this will be slightly larger than the actual glyph path edges due to SDF padding.
 * @property {Array<number>} totalBlockSize - The [width, height] of the text block; this does not include
 *           extra SDF padding so it is accurate to use for measurement.
 * @property {Array<number>} chunkedBounds - List of bounding rects for each consecutive set of N glyphs,
 *           in the format `{start:N, end:N, rect:[minX, minY, maxX, maxY]}`.
 * @property {object} timings - Timing info for various parts of the rendering logic including SDF
 *           generation, layout, etc.
 * @frozen
 */

/**
 * @callback getTextRenderInfo~callback
 * @param {TroikaTextRenderInfo} textRenderInfo
 */

/**
 * Main entry point for requesting the data needed to render a text string with given font parameters.
 * This is an asynchronous call, performing most of the logic in a web worker thread.
 * @param {object} args
 * @param {getTextRenderInfo~callback} callback
 */
function getTextRenderInfo(args, callback) {
  args = assign({}, args)

  // Apply default font here to avoid a 'null' atlas, and convert relative
  // URLs to absolute so they can be resolved in the worker
  args.font = toAbsoluteURL(args.font || CONFIG.defaultFontURL)

  // Normalize text to a string
  args.text = '' + args.text

  // Normalize colors
  if (args.colorRanges != null) {
    let colors = {}
    for (let key in args.colorRanges) {
      if (args.colorRanges.hasOwnProperty(key)) {
        let val = args.colorRanges[key]
        if (typeof val !== 'number') {
          val = tempColor.set(val).getHex()
        }
        colors[key] = val
      }
    }
    args.colorRanges = colors
  }

  Object.freeze(args)

  // Init the atlas for this font if needed
  const {sdfGlyphSize, textureWidth} = CONFIG
  let atlas = atlases[args.font]
  if (!atlas) {
    atlas = atlases[args.font] = {
      sdfTexture: new DataTexture(
        new Uint8Array(sdfGlyphSize * textureWidth),
        textureWidth,
        sdfGlyphSize,
        LuminanceFormat,
        undefined,
        undefined,
        undefined,
        undefined,
        LinearFilter,
        LinearFilter
      )
    }
    atlas.sdfTexture.font = args.font
  }

  // Issue request to the FontProcessor in the worker
  processInWorker(args).then(result => {
    // If the response has newGlyphs, copy them into the atlas texture at the specified indices
    if (result.newGlyphSDFs) {
      result.newGlyphSDFs.forEach(({textureData, atlasIndex}) => {
        const texImg = atlas.sdfTexture.image

        // Grow the texture by power of 2 if needed
        while (texImg.data.length < (atlasIndex + 1) * sdfGlyphSize * sdfGlyphSize) {
          const biggerArray = new Uint8Array(texImg.data.length * 2)
          biggerArray.set(texImg.data)
          texImg.data = biggerArray
          texImg.height *= 2
        }

        // Insert the new glyph's data into the full texture image at the correct offsets
        const cols = texImg.width / sdfGlyphSize
        for (let y = 0; y < sdfGlyphSize; y++) {
          const srcStartIndex = y * sdfGlyphSize
          const tgtStartIndex = texImg.width * sdfGlyphSize * Math.floor(atlasIndex / cols) //full rows
            + (atlasIndex % cols) * sdfGlyphSize //partial row
            + (y * texImg.width) //row within glyph
          for (let x = 0; x < sdfGlyphSize; x++) {
            texImg.data[tgtStartIndex + x] = textureData[srcStartIndex + x]
          }
        }
      })
      atlas.sdfTexture.needsUpdate = true
    }

    // Invoke callback with the text layout arrays and updated texture
    callback(Object.freeze({
      parameters: args,
      sdfTexture: atlas.sdfTexture,
      sdfGlyphSize,
      sdfMinDistancePercent: SDF_DISTANCE_PERCENT,
      glyphBounds: result.glyphBounds,
      glyphAtlasIndices: result.glyphAtlasIndices,
      glyphColors: result.glyphColors,
      caretPositions: result.caretPositions,
      caretHeight: result.caretHeight,
      chunkedBounds: result.chunkedBounds,
      ascender: result.ascender,
      descender: result.descender,
      lineHeight: result.lineHeight,
      topBaseline: result.topBaseline,
      totalBounds: result.totalBounds,
      totalBlockSize: result.totalBlockSize,
      timings: result.timings
    }))
  })
}


/**
 * Preload a given font and optionally pre-generate glyph SDFs for one or more character sequences.
 * This can be useful to avoid long pauses when first showing text in a scene, by preloading the
 * needed fonts and glyphs up front along with other assets.
 *
 * @param {string} font - URL of the font file to preload. If not given, the default font will
 *        be loaded.
 * @param {string|string[]} charSequences - One or more character sequences for which to pre-
 *        generate glyph SDFs. Note that this will honor ligature substitution, so you may need
 *        to specify ligature sequences in addition to their individual characters to get all
 *        possible glyphs, e.g. `["t", "h", "th"]` to get the "t" and "h" glyphs plus the "th" ligature.
 * @param {function} callback - A function that will be called when the preloading is complete.
 */
function preloadFont(font, charSequences, callback) {
  let text = Array.isArray(charSequences) ? charSequences.join('\n') : '' + charSequences
  getTextRenderInfo({ font, text }, callback)
}


// Local assign impl so we don't have to import troika-core
function assign(toObj, fromObj) {
  for (let key in fromObj) {
    if (fromObj.hasOwnProperty(key)) {
      toObj[key] = fromObj[key]
    }
  }
  return toObj
}

// Utility for making URLs absolute
let linkEl
function toAbsoluteURL(path) {
  if (!linkEl) {
    linkEl = typeof document === 'undefined' ? {} : document.createElement('a')
  }
  linkEl.href = path
  return linkEl.href
}


const fontProcessorWorkerModule = defineWorkerModule({
  name: 'FontProcessor',
  dependencies: [
    CONFIG,
    SDF_DISTANCE_PERCENT,
    fontParser,
    createGlyphSegmentsQuadtree,
    createSDFGenerator,
    createFontProcessor
  ],
  init(config, sdfDistancePercent, fontParser, createGlyphSegmentsQuadtree, createSDFGenerator, createFontProcessor) {
    const sdfGenerator = createSDFGenerator(
      createGlyphSegmentsQuadtree,
      {
        sdfTextureSize: config.sdfGlyphSize,
        sdfDistancePercent
      }
    )
    return createFontProcessor(fontParser, sdfGenerator, {
      defaultFontUrl: config.defaultFontURL
    })
  }
})

const processInWorker = defineWorkerModule({
  name: 'TextBuilder',
  dependencies: [fontProcessorWorkerModule, ThenableWorkerModule],
  init(fontProcessor, Thenable) {
    return function(args) {
      const thenable = new Thenable()
      fontProcessor.process(args, thenable.resolve)
      return thenable
    }
  },
  getTransferables(result) {
    // Mark array buffers as transferable to avoid cloning during postMessage
    const transferables = [
      result.glyphBounds.buffer,
      result.glyphAtlasIndices.buffer
    ]
    if (result.caretPositions) {
      transferables.push(result.caretPositions.buffer)
    }
    if (result.newGlyphSDFs) {
      result.newGlyphSDFs.forEach(d => {
        transferables.push(d.textureData.buffer)
      })
    }
    return transferables
  }
})

/*
window._dumpSDFs = function() {
  Object.values(atlases).forEach(atlas => {
    const imgData = atlas.sdfTexture.image.data
    const canvas = document.createElement('canvas')
    const {width, height} = atlas.sdfTexture.image
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        ctx.fillStyle = `rgba(0,0,0,${imgData[y * width + x]/255})`
        ctx.fillRect(x, y, 1, 1)
      }
    }
    const img = new Image()
    img.src = canvas.toDataURL()
    document.body.appendChild(img)
    console.log(img)
  })
}
*/


export {
  configureTextBuilder,
  getTextRenderInfo,
  preloadFont,
  fontProcessorWorkerModule
}
