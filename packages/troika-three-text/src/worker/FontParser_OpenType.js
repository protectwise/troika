/**
 * An adapter that allows Typr.js to be used as if it were (a subset of) the OpenType.js API.
 * Also adds support for WOFF files (not WOFF2).
 */

import opentypeFactory from '../../libs/opentype.factory.js'
import { defineWorkerModule } from 'troika-worker-utils'

function parserFactory(opentype) {
  const cmdArgs = {
    M: ['x', 'y'],
    L: ['x', 'y'],
    Q: ['x1', 'y1', 'x', 'y'],
    C: ['x1', 'y1', 'x2', 'y2', 'x', 'y'],
    Z: []
  }

  function wrapFontObj(otFont) {
    const glyphMap = Object.create(null)

    return {
      unitsPerEm: otFont.unitsPerEm,
      ascender: otFont.ascender,
      descender: otFont.descender,
      forEachGlyph (text, fontSize, letterSpacing, callback) {
        const opentypeOpts = {
          kerning: true,
          features: {liga: true, rlig: true},
          letterSpacing
        }

        otFont.forEachGlyph(text, 0, 0, fontSize, opentypeOpts, (otGlyph, glyphX) => {
          let glyphObj = glyphMap[otGlyph.index]
          if (!glyphObj) {
            glyphObj = glyphMap[otGlyph.index] = {
              index: otGlyph.index,
              advanceWidth: otGlyph.advanceWidth,
              xMin: otGlyph.xMin,
              yMin: otGlyph.yMin,
              xMax: otGlyph.xMax,
              yMax: otGlyph.yMax,
              pathCommandCount: otGlyph.path.commands.length,
              forEachPathCommand (callback) {
                const cbArgs = []
                otGlyph.path.commands.forEach(cmd => {
                  const argNames = cmdArgs[cmd.type]
                  const argCount = argNames.length
                  cbArgs.length = argCount + 1
                  cbArgs[0] = cmd.type
                  for (let i = 0; i < argCount; i++) {
                    cbArgs[i + 1] = cmd[argNames[i]]
                  }
                  callback.apply(null, cbArgs)
                })
              }
            }
          }
          callback(glyphObj, glyphX)
        })
      }
    }
  }

  return function parse(buffer) {
    const otFont = opentype.parse(buffer, {lowMemory: true})
    return wrapFontObj(otFont)
  }
}


const workerModule = defineWorkerModule({
  name: 'OpenType Font Parser',
  dependencies: [opentypeFactory, parserFactory],
  init(opentypeFactory, parserFactory) {
    const opentype = opentypeFactory()
    return parserFactory(opentype)
  }
})


export default workerModule
