import {DataTexture, LinearFilter, LuminanceFormat} from 'three'
import createFontProcessor from './FontProcessor'
import { defineWorkerModule } from '../../../WorkerModules'
import { BasicThenable } from '../../../utils'


/**
 * Default font URL to load in case none is specified or the preferred font fails to load or parse.
 */
const DEFAULT_FONT_URL = 'https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxM.woff' //Roboto Regular

/**
 * URL from which to load the opentype.js library within the worker
 */
const OPENTYPE_URL = 'https://cdn.jsdelivr.net/npm/opentype.js@latest/dist/opentype.min.js'

/**
 * Size of each glyph's SDF texture. This will also be the width of the font's entire SDF texture.
 */
const SDF_GLYPH_SIZE = 64

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
  // Apply default font here to avoid a 'null' atlas
  if (!args.font) {
    args.font = DEFAULT_FONT_URL
  }

  // Init the atlas for this font if needed
  let atlas = atlases[args.font]
  if (!atlas) {
    atlas = atlases[args.font] = {
      sdfTexture: new DataTexture(
        new Uint8Array(SDF_GLYPH_SIZE * SDF_GLYPH_SIZE * SDF_INITIAL_GLYPH_COUNT),
        SDF_GLYPH_SIZE,
        SDF_GLYPH_SIZE * SDF_INITIAL_GLYPH_COUNT,
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
        const arrayOffset = atlasIndex * SDF_GLYPH_SIZE * SDF_GLYPH_SIZE

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


export const fontProcessorWorkerModule = defineWorkerModule({
  dependencies: [
    DEFAULT_FONT_URL,
    SDF_GLYPH_SIZE,
    SDF_DISTANCE_PERCENT,
    OPENTYPE_URL,
    createFontProcessor
  ],
  init(defaultFontUrl, sdfTextureSize, sdfDistancePercent, openTypeURL, createFontProcessor) {
    self.window = self //needed to trick opentype out of thinking we're in Node
    const opentype = self.opentype = {} //gives opentype's UMD somewhere to temporarily attach its exports
    importScripts(openTypeURL) //synchronous
    delete self.opentype
    return createFontProcessor(opentype, {defaultFontUrl, sdfTextureSize, sdfDistancePercent})
  }
})

export const processInWorker = defineWorkerModule({
  dependencies: [fontProcessorWorkerModule, BasicThenable],
  init(fontProcessor, BasicThenable) {
    return function(args) {
      const thenable = new BasicThenable()
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

