import {
  PlaneBufferGeometry,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  Sphere,
  Vector3
} from 'three'


const templateGeometries = {}
function getTemplateGeometry(detail) {
  let geom = templateGeometries[detail]
  if (!geom) {
    geom = templateGeometries[detail] = new PlaneBufferGeometry(1, 1, detail, detail).translate(0.5, 0.5, 0)
  }
  return geom
}
const tempVec3 = new Vector3()

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

    // Preallocate zero-radius bounding sphere
    this.boundingSphere = new Sphere()
  }

  computeBoundingSphere () {
    // No-op; we'll sync the boundingSphere proactively in `updateGlyphs`.
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

  /**
   * Update the geometry for a new set of glyphs.
   * @param {Float32Array} glyphBounds - An array holding the planar bounds for all glyphs
   *        to be rendered, 4 entries for each glyph: x1,x2,y1,y1
   * @param {Float32Array} glyphAtlasIndices - An array holding the index of each glyph within
   *        the SDF atlas texture.
   * @param {Array} totalBounds - An array holding the [minX, minY, maxX, maxY] across all glyphs
   * @param {Array} [chunkedBounds] - An array of objects describing bounds for each chunk of N
   *        consecutive glyphs: `{start:N, end:N, rect:[minX, minY, maxX, maxY]}`. This can be
   *        used with `applyClipRect` to choose an optimized `instanceCount`.
   * @param {Uint8Array} [glyphColors] - An array holding r,g,b values for each glyph.
   */
  updateGlyphs(glyphBounds, glyphAtlasIndices, totalBounds, chunkedBounds, glyphColors) {
    // Update the instance attributes
    updateBufferAttr(this, glyphBoundsAttrName, glyphBounds, 4)
    updateBufferAttr(this, glyphIndexAttrName, glyphAtlasIndices, 1)
    updateBufferAttr(this, glyphColorAttrName, glyphColors, 3)
    this._chunkedBounds = chunkedBounds
    setInstanceCount(this, glyphAtlasIndices.length)

    // Update the boundingSphere based on the total bounds
    const sphere = this.boundingSphere
    sphere.center.set(
      (totalBounds[0] + totalBounds[2]) / 2,
      (totalBounds[1] + totalBounds[3]) / 2,
      0
    )
    sphere.radius = sphere.center.distanceTo(tempVec3.set(totalBounds[0], totalBounds[1], 0))
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
    setInstanceCount(this, count)
  }
}

// Compat for pre r109:
if (!GlyphsGeometry.prototype.setAttribute) {
  GlyphsGeometry.prototype.setAttribute = function(name, attribute) {
    this.attributes[ name ] = attribute
    return this
  }
}


function updateBufferAttr(geom, attrName, newArray, itemSize) {
  const attr = geom.getAttribute(attrName)
  if (newArray) {
    // If length isn't changing, just update the attribute's array data
    if (attr && attr.array.length === newArray.length) {
      attr.array.set(newArray)
      attr.needsUpdate = true
    } else {
      geom.setAttribute(attrName, new InstancedBufferAttribute(newArray, itemSize))
      // If the new attribute has a different size, we also have to (as of r117) manually clear the
      // internal cached max instance count. See https://github.com/mrdoob/three.js/issues/19706
      // It's unclear if this is a threejs bug or a truly unsupported scenario; discussion in
      // that ticket is ambiguous as to whether replacing a BufferAttribute with one of a
      // different size is supported, but https://github.com/mrdoob/three.js/pull/17418 strongly
      // implies it should be supported. It's possible we need to
      delete geom._maxInstanceCount //for r117+, could be fragile
      geom.dispose() //for r118+, more robust feeling, but more heavy-handed than I'd like
    }
  } else if (attr) {
    geom.deleteAttribute(attrName)
  }
}

// Handle maxInstancedCount -> instanceCount rename that happened in three r117
function setInstanceCount(geom, count) {
  geom[geom.hasOwnProperty('instanceCount') ? 'instanceCount' : 'maxInstancedCount'] = count
}


export {
  GlyphsGeometry
}
