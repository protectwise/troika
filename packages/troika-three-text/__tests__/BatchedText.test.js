import { BatchedText } from '../src/BatchedText.js'
import { Text } from '../src/Text.js'
import { glyphColorAttrName } from '../src/GlyphsGeometry.js'

// Supply the results of typesetting directly so these tests need no font or WebGL context.
function setGlyphs(text, colors, count = 2) {
  const glyphAtlasIndices = new Float32Array(count)
  const glyphBounds = new Float32Array(count * 4)
  const blockBounds = [0, 0, count, 1]
  text._textRenderInfo = {
    glyphAtlasIndices,
    glyphBounds,
    glyphColors: colors && new Uint8Array(colors),
    blockBounds,
    sdfTexture: {image: {width: 64, height: 64}},
    sdfGlyphSize: 64,
    sdfExponent: 9
  }
  text.geometry.updateGlyphs(glyphBounds, glyphAtlasIndices, blockBounds, null, text._textRenderInfo.glyphColors)
  text._needsSync = false
  text.dispatchEvent({type: 'synccomplete'})
}

function sync(batch) {
  return new Promise(resolve => batch.sync(resolve))
}

test('packs glyph colors per member through updates, resizing, and removal', async () => {
  const first = new Text()
  const second = new Text()
  const batch = new BatchedText()
  setGlyphs(first, [255, 0, 0, 0, 0, 255])
  setGlyphs(second, null)
  first.outlineWidth = 0.05
  batch.add(first, second)
  await sync(batch)

  const colors = () => Array.from(batch.geometry.getAttribute(glyphColorAttrName).array)
  expect(batch.geometry.getAttribute(glyphColorAttrName)).toBeDefined()
  expect(colors().slice(0, 6)).toEqual([255, 0, 0, 0, 0, 255])
  const [outline, material] = batch.material
  batch._prepareForRender(material)
  expect([batch._dataTextures.main.image.data[27], batch._dataTextures.main.image.data[59]]).toEqual([1, 0])
  batch._prepareForRender(outline)
  // The outline texture's slot 27 is independent from the main texture.
  const outlineData = batch._dataTextures.outline.image.data
  outlineData[27] = 1
  outlineData[59] = 1
  batch._prepareForRender(outline)
  expect([outlineData[27], outlineData[59]]).toEqual([1, 1])

  setGlyphs(first, null)
  setGlyphs(second, [0, 255, 255, 255, 0, 255])
  await sync(batch)
  expect(colors().slice(6)).toEqual([0, 255, 255, 255, 0, 255])
  batch._prepareForRender(material)
  expect([batch._dataTextures.main.image.data[27], batch._dataTextures.main.image.data[59]]).toEqual([0, 1])

  setGlyphs(second, [1, 2, 3, 4, 5, 6, 7, 8, 9], 3)
  await sync(batch)
  expect(colors().slice(6)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  batch.remove(first)
  await sync(batch)
  expect(colors()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])

  setGlyphs(second, null, 3)
  await sync(batch)
  expect(batch.geometry.getAttribute(glyphColorAttrName)).toBeUndefined()
  batch.dispose()
  first.dispose()
  second.dispose()
})
