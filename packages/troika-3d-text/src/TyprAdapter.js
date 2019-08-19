/**
 * An adapter that allows Typr.js to be used as if it were (a subset of) the OpenType.js API.
 */

import typrFactory from '../libs/typr.factory.js'
import {defineWorkerModule} from 'troika-worker-utils'

function createTyprAdapter(Typr) {
  const cmdArgs = {
    M: ['x', 'y'],
    L: ['x', 'y'],
    Q: ['x1', 'y1', 'x', 'y'],
    C: ['x1', 'y1', 'x2', 'y2', 'x', 'y'],
    Z: []
  }

  function wrapAsOpenTypeFont([typrFont]) {
    const glyphMap = Object.create(null)

    const otFont = {
      get glyphs() {
        // impl if we need it
      },
      unitsPerEm: typrFont.head.unitsPerEm,
      ascender: typrFont.hhea.ascender,
      descender: typrFont.hhea.descender,
      forEachGlyph(text, x, y, fontSize, options, callback) {
        // NOTE: `options` other than letterSpacing and tracking will be ignored
        // as Typr does not allow control over things like ligatures and kerning.

        x = x || 0
        y = y || 0
        const fontScale = 1 / otFont.unitsPerEm * fontSize

        const glyphIndices = Typr.U.stringToGlyphs(typrFont, text)
        glyphIndices.forEach(glyphIndex => {
          let otGlyph = glyphMap[glyphIndex]
          if (!otGlyph) {
            // !!! NOTE: Typr doesn't expose a public accessor for the glyph data, so this just
            // copies how it parses that data in Typr.U._drawGlyf -- this may be fragile.
            let typrGlyph = Typr.glyf._parseGlyf(typrFont, glyphIndex) || {xMin: 0, xMax: 0, yMin: 0, yMax: 0}

            const {cmds, crds} = Typr.U.glyphToPath(typrFont, glyphIndex)
            let crdIndex = 0
            const commands = cmds.map(type => {
              const out = {type}
              cmdArgs[type].forEach(argName => {
                out[argName] = crds[crdIndex++]
              })
              return out
            })

            otGlyph = glyphMap[glyphIndex] = {
              font: otFont,
              index: glyphIndex,
              unicode: getUnicodeForGlyph(typrFont, glyphIndex),
              advanceWidth: typrFont.hmtx.aWidth[glyphIndex],
              xMin: typrGlyph.xMin,
              yMin: typrGlyph.yMin,
              xMax: typrGlyph.xMax,
              yMax: typrGlyph.yMax,
              path: {
                commands
              }
            }
          }

          callback.call(otFont, otGlyph, x, y, fontSize, options)

          if (otGlyph.advanceWidth) {
            x += otGlyph.advanceWidth * fontScale
          }
          if (options.letterSpacing) {
            x += options.letterSpacing * fontSize
          } else if (options.tracking) {
            x += (options.tracking / 1000) * fontSize
          }
        })
        return x
      }
    }

    return otFont
  }


  function getUnicodeForGlyph(typrFont, glyphIndex) {
    let glyphToUnicodeMap = typrFont.glyphToUnicodeMap
    if (!glyphToUnicodeMap) {
      glyphToUnicodeMap = typrFont.glyphToUnicodeMap = Object.create(null)

      // NOTE: this logic for traversing the cmap table formats follows that in Typr.U.codeToGlyph
      const cmap = typrFont.cmap;

      let tableIndex = -1
      if (cmap.p0e4 != null) tableIndex = cmap.p0e4
      else if (cmap.p3e1 != null) tableIndex = cmap.p3e1
      else if (cmap.p1e0 != null) tableIndex = cmap.p1e0
      else if (cmap.p0e3 != null) tableIndex = cmap.p0e3
      if (tableIndex === -1) {
        throw "no familiar platform and encoding!"
      }
      const table = cmap.tables[tableIndex];

      if (table.format === 0) {
        for (let code = 0; code < table.map.length; code++) {
          glyphToUnicodeMap[table.map[code]] = code
        }
      }
      else if (table.format === 4) {
        const startCodes = table.startCount
        const endCodes = table.endCount
        for (let i = 0; i < startCodes.length; i++) {
          for (let code = startCodes[i]; code <= endCodes[i]; code++) {
            glyphToUnicodeMap[Typr.U.codeToGlyph(typrFont, code)] = code
          }
        }
      }
      else if (table.format === 12)
      {
        table.groups.forEach(([startCharCode, endCharCode, startGlyphID]) => {
          let glyphId = startGlyphID
          for (let code = startCharCode; code <= endCharCode; code++) {
            glyphToUnicodeMap[glyphId++] = code
          }
        })
      }
      else {
        throw "unknown cmap table format " + table.format
      }
    }
    return glyphToUnicodeMap[glyphIndex] || 0
  }


  // This object should behave like the 'opentype' global
  return {
    load (url, callback, opt) {
      const request = new XMLHttpRequest()
      request.open('get', url, true)
      request.responseType = 'arraybuffer'
      request.onload = function () {
        if (request.response) {
          let font
          try {
            font = wrapAsOpenTypeFont(Typr.parse(request.response))
          } catch (e) {
            return callback(e, null);
          }
          return callback(null, font);
        } else {
          return callback('Font could not be loaded: ' + request.statusText);
        }
      }
      request.onerror = function () {
        callback('Font could not be loaded');
      }
      request.send();
    }
  }
}


const workerModule = defineWorkerModule({
  dependencies: [typrFactory, createTyprAdapter],
  init(typrFactory, createTyprAdapter) {
    const Typr = typrFactory()
    return createTyprAdapter.bind(null, Typr)
  }
})


export default workerModule
