import {
  PlaneBufferGeometry,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  Sphere,
  Vector3
} from 'three'


const templateGeometry = new PlaneBufferGeometry(1, 1).translate(0.5, 0.5, 0)
const tempVec3 = new Vector3()

const glyphBoundsAttrName = 'aTroikaGlyphBounds'
const glyphIndexAttrName = 'aTroikaGlyphIndex'



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

    // Base per-instance attributes
    this.copy(templateGeometry)

    // Preallocate zero-radius bounding sphere
    this.boundingSphere = new Sphere()
  }

  computeBoundingSphere () {
    // No-op; we'll sync the boundingSphere proactively in `updateGlyphs`.
  }

  /**
   * Update the geometry for a new set of glyphs.
   * @param {Float32Array} glyphBounds - An array holding the planar bounds for all glyphs
   *        to be rendered, 4 entries for each glyph: x1,x2,y1,y1
   * @param {Float32Array} glyphAtlasIndices - An array holding the index of each glyph within
   *        the SDF atlas texture.
   * @param {Array} totalBounds - An array holding the [minX, minY, maxX, maxY] across all glyphs
   */
  updateGlyphs(glyphBounds, glyphAtlasIndices, totalBounds) {
    // Update the instance attributes
    updateBufferAttr(this, glyphBoundsAttrName, glyphBounds, 4)
    updateBufferAttr(this, glyphIndexAttrName, glyphAtlasIndices, 1)
    this.maxInstancedCount = glyphAtlasIndices.length

    // Update the boundingSphere based on the total bounds
    const sphere = this.boundingSphere
    sphere.center.set(
      (totalBounds[0] + totalBounds[2]) / 2,
      (totalBounds[1] + totalBounds[3]) / 2,
      0
    )
    sphere.radius = sphere.center.distanceTo(tempVec3.set(totalBounds[0], totalBounds[1], 0))
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
  // If length isn't changing, just update the attribute's array data
  if (attr && attr.array.length === newArray.length) {
    attr.array.set(newArray)
    attr.needsUpdate = true
  } else {
    geom.setAttribute(attrName, new InstancedBufferAttribute(newArray, itemSize))
  }
}


export {
  GlyphsGeometry
}
