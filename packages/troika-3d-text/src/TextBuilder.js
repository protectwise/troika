import { DataTexture, LinearFilter, LuminanceFormat } from 'three'
import createFontProcessor from './FontProcessor.js'
import opentypeFactory from '../libs/opentype.factory.js'
import { defineWorkerModule, ThenableWorkerModule } from 'troika-worker-utils'

const CONFIG = {
  defaultFontURL: 'https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxM.woff', //Roboto Regular
  sdfGlyphSize: 64
}
const linkEl = document.createElement('a') //for resolving relative URLs to absolute
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
 */
export function configureTextBuilder(config) {
  if (hasRequested) {
    console.warn('configureTextBuilder called after first font request; will be ignored.')
  } else {
    assign(CONFIG, config)
  }
}


/**
 * How many glyphs the font's SDF texture should initially be created to hold.
 */
const SDF_INITIAL_GLYPH_COUNT = 64

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
 * Main entry point for requesting the data needed to render a text string with given font parameters.
 * This is an asynchronous call, performing most of the logic in a web worker thread.
 * @param args
 * @param callback
 */
export function getTextRenderInfo(args, callback) {
  args = assign({}, args)

  // Apply default font here to avoid a 'null' atlas, and convert relative
  // URLs to absolute so they can be resolved in the worker
  linkEl.href = args.font || CONFIG.defaultFontURL
  args.font = linkEl.href

  // Normalize text to a string
  args.text = '' + args.text

  // Init the atlas for this font if needed
  const sdfGlyphSize = CONFIG.sdfGlyphSize
  let atlas = atlases[args.font]
  if (!atlas) {
    atlas = atlases[args.font] = {
      sdfTexture: new DataTexture(
        new Uint8Array(sdfGlyphSize * sdfGlyphSize * SDF_INITIAL_GLYPH_COUNT),
        sdfGlyphSize,
        sdfGlyphSize * SDF_INITIAL_GLYPH_COUNT,
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
        const arrayOffset = atlasIndex * sdfGlyphSize * sdfGlyphSize

        // Grow the texture by power of 2 if needed
        while (arrayOffset > texImg.data.length - 1) {
          const biggerArray = new Uint8Array(texImg.data.length * 2)
          biggerArray.set(texImg.data)
          texImg.data = biggerArray
          texImg.height *= 2
        }

        // Insert the new glyph's data at the proper index
        texImg.data.set(textureData, arrayOffset)
      })
      atlas.sdfTexture.needsUpdate = true
    }

    // Invoke callback with the text layout arrays and updated texture
    callback({
      sdfTexture: atlas.sdfTexture,
      sdfMinDistancePercent: SDF_DISTANCE_PERCENT,
      glyphBounds: result.glyphBounds,
      glyphIndices: result.glyphIndices,
      totalBounds: result.totalBounds,
      totalBlockSize: result.totalBlockSize
    })
  })
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


export const fontProcessorWorkerModule = defineWorkerModule({
  dependencies: [
    CONFIG,
    SDF_DISTANCE_PERCENT,
    opentypeFactory,
    createFontProcessor
  ],
  init(config, sdfDistancePercent, opentypeFactory, createFontProcessor) {
    const opentype = opentypeFactory()
    return createFontProcessor(opentype, {
      defaultFontUrl: config.defaultFontURL,
      sdfTextureSize: config.sdfGlyphSize,
      sdfDistancePercent
    })
  }
})

export const processInWorker = defineWorkerModule({
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
    const transferables = [result.glyphBounds.buffer, result.glyphIndices.buffer]
    if (result.newGlyphSDFs) {
      result.newGlyphSDFs.forEach(d => {
        transferables.push(d.textureData.buffer)
      })
    }
    return transferables
  }
})

