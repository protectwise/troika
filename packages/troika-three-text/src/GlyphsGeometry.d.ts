import { InstancedBufferGeometry, Vector4 } from 'three'

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
export class GlyphsGeometry extends InstancedBufferGeometry {
    set detail(arg: any);
    get detail(): any;
    set curveRadius(arg: any);
    get curveRadius(): any;
    groups: {
        start: number;
        count: number;
        materialIndex: number;
    }[];
    boundingSphere: any;
    boundingBox: any;
    computeBoundingSphere(): void;
    computeBoundingBox(): void;
    setSide(side: any): void;
    _detail: any;
    _curveRadius: any;
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
    updateGlyphs(glyphBounds: Float32Array, glyphAtlasIndices: Float32Array, blockBounds: any[], chunkedBounds?: any[], glyphColors?: Uint8Array): void;
    _blockBounds: any[];
    _chunkedBounds: any[];
    instanceCount: any;
    _updateBounds(): void;
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
    applyClipRect(clipRect: Vector4): void;
}
