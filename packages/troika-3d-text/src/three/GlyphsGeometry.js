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

A downside of this is that the UVs end up being 0-1 within each glyph rather than across
the entire text block; we may be able to work around that with an option to instance the
`uv` attribute. (TODO)

Another downside of course is the rare-but-possible lack of the instanced arrays extension,
which we could potentially work around with a fallback non-instanced implementation.

*/
class GlyphsGeometry extends InstancedBufferGeometry {
  constructor() {
    super()

    // Base per-instance attributes
    this.copy(templateGeometry)

    // Add our custom instanced attributes
    this.addAttribute(
      glyphBoundsAttrName,
      new InstancedBufferAttribute(new Float32Array(0), 4)
    )
    this.addAttribute(
      glyphIndexAttrName,
      new InstancedBufferAttribute(new Float32Array(0), 1)
    )

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
   * @param {Float32Array} glyphIndices - An array holding the index of each glyph within
   *        the SDF atlas texture.
   * @param {Array} totalBounds - An array holding the [minX, minY, maxX, maxY] across all glyphs
   */
  updateGlyphs(glyphBounds, glyphIndices, totalBounds) {
    // Update the instance attributes
    updateBufferAttrArray(this.attributes[glyphBoundsAttrName], glyphBounds)
    updateBufferAttrArray(this.attributes[glyphIndexAttrName], glyphIndices)
    this.maxInstancedCount = glyphIndices.length

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



function updateBufferAttrArray(attr, newArray) {
  if (attr.array.length === newArray.length) {
    attr.array.set(newArray)
  } else {
    attr.setArray(newArray)
  }
  attr.needsUpdate = true
}


export {
  GlyphsGeometry
}
