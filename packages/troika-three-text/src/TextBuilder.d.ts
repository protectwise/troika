import { Texture } from 'three'

/**
 * ~callback
 */
export type getTextRenderInfo = (textRenderInfo: TroikaTextRenderInfo) => any;
/**
 * - Format of the result from `getTextRenderInfo`.
 */
export type TroikaTextRenderInfo = {
    /**
     * - The normalized input arguments to the render call.
     */
    parameters: object;
    /**
     * - The SDF atlas texture.
     */
    sdfTexture: Texture;
    /**
     * - The size of each glyph's SDF; see `configureTextBuilder`.
     */
    sdfGlyphSize: number;
    /**
     * - The exponent used in encoding the SDF's values; see `configureTextBuilder`.
     */
    sdfExponent: number;
    /**
     * - List of [minX, minY, maxX, maxY] quad bounds for each glyph.
     */
    glyphBounds: Float32Array;
    /**
     * - List holding each glyph's index in the SDF atlas.
     */
    glyphAtlasIndices: Float32Array;
    /**
     * - List holding each glyph's [r, g, b] color, if `colorRanges` was supplied.
     */
    glyphColors?: Uint8Array;
    /**
     * - A list of caret positions for all characters in the string; each is
     * three elements: the starting X, the ending X, and the bottom Y for the caret.
     */
    caretPositions?: Float32Array;
    /**
     * - An appropriate height for all selection carets.
     */
    caretHeight?: number;
    /**
     * - The font's ascender metric.
     */
    ascender: number;
    /**
     * - The font's descender metric.
     */
    descender: number;
    /**
     * - The font's cap height metric, based on the height of Latin capital letters.
     */
    capHeight: number;
    /**
     * - The font's x height metric, based on the height of Latin lowercase letters.
     */
    xHeight: number;
    /**
     * - The final computed lineHeight measurement.
     */
    lineHeight: number;
    /**
     * - The y position of the top line's baseline.
     */
    topBaseline: number;
    /**
     * - The total [minX, minY, maxX, maxY] rect of the whole text block;
     * this can include extra vertical space beyond the visible glyphs due to lineHeight, and is
     * equivalent to the dimensions of a block-level text element in CSS.
     */
    blockBounds: Array<number>;
    /**
     * - The total [minX, minY, maxX, maxY] rect of the whole text block;
     * unlike `blockBounds` this is tightly wrapped to the visible glyph paths.
     */
    visibleBounds: Array<number>;
    /**
     * - List of bounding rects for each consecutive set of N glyphs,
     * in the format `{start:N, end:N, rect:[minX, minY, maxX, maxY]}`.
     */
    chunkedBounds: Array<object>;
    /**
     * - Timing info for various parts of the rendering logic including SDF
     * generation, typesetting, etc.
     */
    timings: object;
};
/**
 * Customizes the text builder configuration. This must be called prior to the first font processing
 * request, and applies to all fonts.
 *
 * @param {String} config.defaultFontURL - The URL of the default font to use for text processing
 *                 requests, in case none is specified or the specifiede font fails to load or parse.
 *                 Defaults to "Roboto Regular" from Google Fonts.
 * @param {Number} config.sdfGlyphSize - The default size of each glyph's SDF (signed distance field)
 *                 texture used for rendering. Must be a power-of-two number, and applies to all fonts,
 *                 but note that this can also be overridden per call to `getTextRenderInfo()`.
 *                 Larger sizes can improve the quality of glyph rendering by increasing the sharpness
 *                 of corners and preventing loss of very thin lines, at the expense of memory. Defaults
 *                 to 64 which is generally a good balance of size and quality.
 * @param {Number} config.sdfExponent - The exponent used when encoding the SDF values. A higher exponent
 *                 shifts the encoded 8-bit values to achieve higher precision/accuracy at texels nearer
 *                 the glyph's path, with lower precision further away. Defaults to 9.
 * @param {Number} config.sdfMargin - How much space to reserve in the SDF as margin outside the glyph's
 *                 path, as a percentage of the SDF width. A larger margin increases the quality of
 *                 extruded glyph outlines, but decreases the precision available for the glyph itself.
 *                 Defaults to 1/16th of the glyph size.
 * @param {Number} config.textureWidth - The width of the SDF texture; must be a power of 2. Defaults to
 *                 2048 which is a safe maximum texture dimension according to the stats at
 *                 https://webglstats.com/webgl/parameter/MAX_TEXTURE_SIZE and should allow for a
 *                 reasonably large number of glyphs (default glyph size of 64^2 and safe texture size of
 *                 2048^2, times 4 channels, allows for 4096 glyphs.) This can be increased if you need to
 *                 increase the glyph size and/or have an extraordinary number of glyphs.
 */
export function configureTextBuilder(config: any): void;
/**
 * @typedef {object} TroikaTextRenderInfo - Format of the result from `getTextRenderInfo`.
 * @property {object} parameters - The normalized input arguments to the render call.
 * @property {Texture} sdfTexture - The SDF atlas texture.
 * @property {number} sdfGlyphSize - The size of each glyph's SDF; see `configureTextBuilder`.
 * @property {number} sdfExponent - The exponent used in encoding the SDF's values; see `configureTextBuilder`.
 * @property {Float32Array} glyphBounds - List of [minX, minY, maxX, maxY] quad bounds for each glyph.
 * @property {Float32Array} glyphAtlasIndices - List holding each glyph's index in the SDF atlas.
 * @property {Uint8Array} [glyphColors] - List holding each glyph's [r, g, b] color, if `colorRanges` was supplied.
 * @property {Float32Array} [caretPositions] - A list of caret positions for all characters in the string; each is
 *           three elements: the starting X, the ending X, and the bottom Y for the caret.
 * @property {number} [caretHeight] - An appropriate height for all selection carets.
 * @property {number} ascender - The font's ascender metric.
 * @property {number} descender - The font's descender metric.
 * @property {number} capHeight - The font's cap height metric, based on the height of Latin capital letters.
 * @property {number} xHeight - The font's x height metric, based on the height of Latin lowercase letters.
 * @property {number} lineHeight - The final computed lineHeight measurement.
 * @property {number} topBaseline - The y position of the top line's baseline.
 * @property {Array<number>} blockBounds - The total [minX, minY, maxX, maxY] rect of the whole text block;
 *           this can include extra vertical space beyond the visible glyphs due to lineHeight, and is
 *           equivalent to the dimensions of a block-level text element in CSS.
 * @property {Array<number>} visibleBounds - The total [minX, minY, maxX, maxY] rect of the whole text block;
 *           unlike `blockBounds` this is tightly wrapped to the visible glyph paths.
 * @property {Array<object>} chunkedBounds - List of bounding rects for each consecutive set of N glyphs,
 *           in the format `{start:N, end:N, rect:[minX, minY, maxX, maxY]}`.
 * @property {object} timings - Timing info for various parts of the rendering logic including SDF
 *           generation, typesetting, etc.
 * @frozen
 */
/**
 * @callback getTextRenderInfo~callback
 * @param {TroikaTextRenderInfo} textRenderInfo
 */
/**
 * Main entry point for requesting the data needed to render a text string with given font parameters.
 * This is an asynchronous call, performing most of the logic in a web worker thread.
 * @param {object} args
 * @param {getTextRenderInfo~callback} callback
 */
export function getTextRenderInfo(args: object, callback: any): void;
/**
 * Preload a given font and optionally pre-generate glyph SDFs for one or more character sequences.
 * This can be useful to avoid long pauses when first showing text in a scene, by preloading the
 * needed fonts and glyphs up front along with other assets.
 *
 * @param {object} options
 * @param {string} options.font - URL of the font file to preload. If not given, the default font will
 *        be loaded.
 * @param {string|string[]} options.characters - One or more character sequences for which to pre-
 *        generate glyph SDFs. Note that this will honor ligature substitution, so you may need
 *        to specify ligature sequences in addition to their individual characters to get all
 *        possible glyphs, e.g. `["t", "h", "th"]` to get the "t" and "h" glyphs plus the "th" ligature.
 * @param {number} options.sdfGlyphSize - The size at which to prerender the SDF textures for the
 *        specified `characters`.
 * @param {function} callback - A function that will be called when the preloading is complete.
 */
export function preloadFont({ font, characters, sdfGlyphSize }: {
    font: string;
    characters: string | string[];
    sdfGlyphSize: number;
}, callback: Function): void;
export const typesetterWorkerModule: any;
export function dumpSDFTextures(): void;
