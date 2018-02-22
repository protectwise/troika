import {DataTexture, LinearFilter, LuminanceFormat} from 'three'
import createFontProcessor from './FontProcessor'


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
  issueWorkerRequest(args, result => {
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
      totalBounds: result.totalBounds
    })
  })
}





let _lastMsgId = 0


/**
 * Issue a request to the FontProcessor worker
 * @param args
 * @param callback
 */
export function issueWorkerRequest(args, callback) {
  const worker = getWorker()
  const messageId = ++_lastMsgId
  const onmessage = e => {
    if (e.data.messageId === messageId) {
      if (e.data.error) {
        console.error('FontProcessor worker error', e.data.error)
      } else {
        callback(e.data.result)
      }
      worker.removeEventListener('message', onmessage)
    }
  }
  worker.addEventListener('message', onmessage)
  worker.postMessage({
    messageId,
    args
  })
}


/**
 * Initialize a single instance of the Worker and return it
 */
function getWorker() {
  const loadOpenTypeFn = function(url) {
    self.window = self //needed to trick opentype out of thinking we're in Node
    self.opentype = {} //gives opentype's UMD somewhere to temporarily attach its exports
    importScripts(url)
    return self.opentype
  }.toString()

  const createOnMessageFn = function (processFn) {
    return e => {
      const msg = e.data
      const messageId = msg.messageId
      try {
        processFn(msg.args, result => {
          postMessage(
            {messageId, result},
            //new SDF texture array buffers are transferable:
            result.newGlyphSDFs ? result.newGlyphSDFs.map(d => d.textureData.buffer) : undefined
          )
        })
      } catch(error) {
        postMessage({messageId, error: error.stack})
      }
    }
  }.toString()

  const config = JSON.stringify({
    defaultFontUrl: DEFAULT_FONT_URL,
    sdfTextureSize: SDF_GLYPH_SIZE,
    sdfDistancePercent: SDF_DISTANCE_PERCENT
  })

  const workerCode = `
self.onmessage = (${createOnMessageFn})(
  (${createFontProcessor.toString()})(
    (${loadOpenTypeFn})('${OPENTYPE_URL}'),
    ${config}
  )
)`

  const worker = new Worker(
    URL.createObjectURL(new Blob([workerCode], {type:'text/javascript'}))
  )

  // Return the singleton from now on
  getWorker = () => worker

  return worker
}



