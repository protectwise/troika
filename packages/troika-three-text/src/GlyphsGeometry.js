import {
  PlaneGeometry,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  Sphere,
  Box3,
} from 'three'

const templateGeometries = {}

function getTemplateGeometry(detail) {
  let geom = templateGeometries[detail]
  if (!geom) {
    geom = templateGeometries[detail] = new PlaneGeometry(1, 1, detail, detail).translate(0.5, 0.5, 0)
  }
  return geom
}

const glyphBoundsAttrName = 'aTroikaGlyphBounds'
const glyphIndexAttrName = 'aTroikaGlyphIndex'
const glyphColorAttrName = 'aTroikaGlyphColor'

/**
@class GlyphsGeometry

A specialized Geometry for rendering a set of text glyphs. Uses InstancedBufferGeometry to
render the glyphs using GPU instancing of a single quad, rather than constructing a whole
geometry with vertices, for much smaller attribute arraybuffers according to this math:

  Where N = number of glyphs...

  Instanced:
  - position: 4 * 3
  - index: 2 * 3
  - normal: 4 * 3
  - uv: 4 * 2
  - glyph x/y bounds: N * 4
  - glyph indices: N * 1
  = 5N + 38

  Non-instanced:
  - position: N * 4 * 3
  - index: N * 2 * 3
  - normal: N * 4 * 3
  - uv: N * 4 * 2
  - glyph indices: N * 1
  = 39N

A downside of this is the rare-but-possible lack of the instanced arrays extension,
which we could potentially work around with a fallback non-instanced implementation.

*/
class GlyphsGeometry extends InstancedBufferGeometry {
  constructor() {
    super()

    this.detail = 1
    this.curveRadius = 0

    // Define groups for rendering text outline as a separate pass; these will only
    // be used when the `material` getter returns an array, i.e. outlineWidth > 0.
    this.groups = [
      {start: 0, count: Infinity, materialIndex: 0},
      {start: 0, count: Infinity, materialIndex: 1}
    ]

    // Preallocate empty bounding objects
    this.boundingSphere = new Sphere()
    this.boundingBox = new Box3()
  }

  computeBoundingSphere () {
    // No-op; we'll sync the boundingSphere proactively when needed.
  }

  computeBoundingBox() {
    // No-op; we'll sync the boundingBox proactively when needed.
  }

  set detail(detail) {
    if (detail !== this._detail) {
      this._detail = detail
      if (typeof detail !== 'number' || detail < 1) {
        detail = 1
      }
      let tpl = getTemplateGeometry(detail)
      ;['position', 'normal', 'uv'].forEach(attr => {
        this.attributes[attr] = tpl.attributes[attr].clone()
      })
      this.setIndex(tpl.getIndex().clone())
    }
  }
  get detail() {
    return this._detail
  }

  set curveRadius(r) {
    if (r !== this._curveRadius) {
      this._curveRadius = r
      this._updateBounds()
    }
  }
  get curveRadius() {
    return this._curveRadius
  }

  /**
   * Update the geometry for a new set of glyphs.
   * @param {Float32Array} glyphBounds - An array holding the planar bounds for all glyphs
   *        to be rendered, 4 entries for each glyph: x1,x2,y1,y1
   * @param {Float32Array} glyphAtlasIndices - An array holding the index of each glyph within
   *        the SDF atlas texture.
   * @param {Array} blockBounds - An array holding the [minX, minY, maxX, maxY] across all glyphs
   * @param {Array} [chunkedBounds] - An array of objects describing bounds for each chunk of N
   *        consecutive glyphs: `{start:N, end:N, rect:[minX, minY, maxX, maxY]}`. This can be
   *        used with `applyClipRect` to choose an optimized `instanceCount`.
   * @param {Uint8Array} [glyphColors] - An array holding r,g,b values for each glyph.
   */
  updateGlyphs(glyphBounds, glyphAtlasIndices, blockBounds, chunkedBounds, glyphColors) {
    // Update the instance attributes
    this.updateAttributeData(glyphBoundsAttrName, glyphBounds, 4)
    this.updateAttributeData(glyphIndexAttrName, glyphAtlasIndices, 1)
    this.updateAttributeData(glyphColorAttrName, glyphColors, 3)
    this._blockBounds = blockBounds
    this._chunkedBounds = chunkedBounds
    this.instanceCount = glyphAtlasIndices.length
    this._updateBounds()
  }

  _updateBounds() {
    const bounds = this._blockBounds
    if (bounds) {
      const { curveRadius, boundingBox: bbox } = this
      if (curveRadius) {
        const { PI, floor, min, max, sin, cos } = Math
        const halfPi = PI / 2
        const twoPi = PI * 2
        const absR = Math.abs(curveRadius)
        const leftAngle = bounds[0] / absR
        const rightAngle = bounds[2] / absR
        const minX = floor((leftAngle + halfPi) / twoPi) !== floor((rightAngle + halfPi) / twoPi)
          ? -absR : min(sin(leftAngle) * absR, sin(rightAngle) * absR)
        const maxX = floor((leftAngle - halfPi) / twoPi) !== floor((rightAngle - halfPi) / twoPi)
          ? absR : max(sin(leftAngle) * absR, sin(rightAngle) * absR)
        const maxZ = floor((leftAngle + PI) / twoPi) !== floor((rightAngle + PI) / twoPi)
          ? absR * 2 : max(absR - cos(leftAngle) * absR, absR - cos(rightAngle) * absR)
        bbox.min.set(minX, bounds[1], curveRadius < 0 ? -maxZ : 0)
        bbox.max.set(maxX, bounds[3], curveRadius < 0 ? 0 : maxZ)
      } else {
        bbox.min.set(bounds[0], bounds[1], 0)
        bbox.max.set(bounds[2], bounds[3], 0)
      }
      bbox.getBoundingSphere(this.boundingSphere)
    }
  }

  /**
   * Given a clipping rect, and the chunkedBounds from the last updateGlyphs call, choose the lowest
   * `instanceCount` that will show all glyphs within the clipped view. This is an optimization
   * for long blocks of text that are clipped, to skip vertex shader evaluation for glyphs that would
   * be clipped anyway.
   *
   * Note that since `drawElementsInstanced[ANGLE]` only accepts an instance count and not a starting
   * offset, this optimization becomes less effective as the clipRect moves closer to the end of the
   * text block. We could fix that by switching from instancing to a full geometry with a drawRange,
   * but at the expense of much larger attribute buffers (see classdoc above.)
   *
   * @param {Vector4} clipRect
   */
  applyClipRect(clipRect) {
    let count = this.getAttribute(glyphIndexAttrName).count
    let chunks = this._chunkedBounds
    if (chunks) {
      for (let i = chunks.length; i--;) {
        count = chunks[i].end
        let rect = chunks[i].rect
        // note: both rects are l-b-r-t
        if (rect[1] < clipRect.w && rect[3] > clipRect.y && rect[0] < clipRect.z && rect[2] > clipRect.x) {
          break
        }
      }
    }
    this.instanceCount = count
  }

  /**
   * Utility for updating instance attributes with automatic resizing
   */
  updateAttributeData(attrName, newArray, itemSize) {
    const attr = this.getAttribute(attrName)
    if (newArray) {
      // If length isn't changing, just update the attribute's array data
      if (attr && attr.array.length === newArray.length) {
        attr.array.set(newArray)
        attr.needsUpdate = true
      } else {
        this.setAttribute(attrName, new InstancedBufferAttribute(newArray, itemSize))
        // If the new attribute has a different size, we also have to (as of r117) manually clear the
        // internal cached max instance count. See https://github.com/mrdoob/three.js/issues/19706
        // It's unclear if this is a threejs bug or a truly unsupported scenario; discussion in
        // that ticket is ambiguous as to whether replacing a BufferAttribute with one of a
        // different size is supported, but https://github.com/mrdoob/three.js/pull/17418 strongly
        // implies it should be supported. It's possible we need to
        delete this._maxInstanceCount //for r117+, could be fragile
        this.dispose() //for r118+, more robust feeling, but more heavy-handed than I'd like
      }
    } else if (attr) {
      this.deleteAttribute(attrName)
    }
  }
}

export {
  GlyphsGeometry,
  glyphBoundsAttrName,
  glyphColorAttrName,
  glyphIndexAttrName,
}
