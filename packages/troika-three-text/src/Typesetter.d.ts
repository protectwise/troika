/**
 * Factory function that creates a self-contained environment for processing text typesetting requests.
 *
 * It is important that this function has no closure dependencies, so that it can be easily injected
 * into the source for a Worker without requiring a build step or complex dependency loading. All its
 * dependencies must be passed in at initialization.
 *
 * @param {function} fontParser - a function that accepts an ArrayBuffer of the font data and returns
 * a standardized structure giving access to the font and its glyphs:
 *   {
 *     unitsPerEm: number,
 *     ascender: number,
 *     descender: number,
 *     capHeight: number,
 *     xHeight: number,
 *     lineGap: number,
 *     forEachGlyph(string, fontSize, letterSpacing, callback) {
 *       //invokes callback for each glyph to render, passing it an object:
 *       callback({
 *         index: number,
 *         advanceWidth: number,
 *         xMin: number,
 *         yMin: number,
 *         xMax: number,
 *         yMax: number,
 *         path: string,
 *         pathCommandCount: number
 *       })
 *     }
 *   }
 * @param {object} bidi - the bidi.js implementation object
 * @param {Object} config
 * @return {Object}
 */
export function createTypesetter(fontParser: Function, bidi: object, config: any): any;
