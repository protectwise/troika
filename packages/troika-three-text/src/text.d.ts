import { Material, Mesh } from 'three'

/**
 * @class Text
 *
 * A ThreeJS Mesh that renders a string of text on a plane in 3D space using signed distance
 * fields (SDF).
 */
export class Text extends Mesh {
  /**
   * @member {string} text
   * The string of text to be rendered.
   */
  text: string;
  /**
   * @member {number|string} anchorX
   * Defines the horizontal position in the text block that should line up with the local origin.
   * Can be specified as a numeric x position in local units, a string percentage of the total
   * text block width e.g. `'25%'`, or one of the following keyword strings: 'left', 'center',
   * or 'right'.
   */
  anchorX: number;
  /**
   * @member {number|string} anchorX
   * Defines the vertical position in the text block that should line up with the local origin.
   * Can be specified as a numeric y position in local units (note: down is negative y), a string
   * percentage of the total text block height e.g. `'25%'`, or one of the following keyword strings:
   * 'top', 'top-baseline', 'top-cap', 'top-ex', 'middle', 'bottom-baseline', or 'bottom'.
   */
  anchorY: number;
  set curveRadius(arg: any);
  get curveRadius(): any;
  /**
   * @member {string} direction
   * Sets the base direction for the text. The default value of "auto" will choose a direction based
   * on the text's content according to the bidi spec. A value of "ltr" or "rtl" will force the direction.
   */
  direction: string;
  /**
   * @member {string} font
   * URL of a custom font to be used. Font files can be in .ttf, .otf, or .woff (not .woff2) formats.
   * Defaults to the Roboto font loaded from Google Fonts.
   */
  font: any;
  /**
   * @member {number} fontSize
   * The size at which to render the font in local units; corresponds to the em-box height
   * of the chosen `font`.
   */
  fontSize: number;
  /**
   * @member {number} letterSpacing
   * Sets a uniform adjustment to spacing between letters after kerning is applied. Positive
   * numbers increase spacing and negative numbers decrease it.
   */
  letterSpacing: number;
  /**
   * @member {number|string} lineHeight
   * Sets the height of each line of text, as a multiple of the `fontSize`. Defaults to 'normal'
   * which chooses a reasonable height based on the chosen font's ascender/descender metrics.
   */
  lineHeight: string;
  /**
   * @member {number} maxWidth
   * The maximum width of the text block, above which text may start wrapping according to the
   * `whiteSpace` and `overflowWrap` properties.
   */
  maxWidth: number;
  /**
   * @member {string} overflowWrap
   * Defines how text wraps if the `whiteSpace` property is `normal`. Can be either `'normal'`
   * to break at whitespace characters, or `'break-word'` to allow breaking within words.
   * Defaults to `'normal'`.
   */
  overflowWrap: string;
  /**
   * @member {string} textAlign
   * The horizontal alignment of each line of text within the overall text bounding box.
   */
  textAlign: string;
  /**
   * @member {number} textIndent
   * Indentation for the first character of a line; see CSS `text-indent`.
   */
  textIndent: number;
  /**
   * @member {string} whiteSpace
   * Defines whether text should wrap when a line reaches the `maxWidth`. Can
   * be either `'normal'` (the default), to allow wrapping according to the `overflowWrap` property,
   * or `'nowrap'` to prevent wrapping. Note that `'normal'` here honors newline characters to
   * manually break lines, making it behave more like `'pre-wrap'` does in CSS.
   */
  whiteSpace: string;

  /**
   * @member {string|number|THREE.Color} color
   * This is a shortcut for setting the `color` of the text's material. You can use this
   * if you don't want to specify a whole custom `material`. Also, if you do use a custom
   * `material`, this color will only be used for this particuar Text instance, even if
   * that same material instance is shared across multiple Text objects.
   */
  color: any;
  /**
   * @member {object|null} colorRanges
   * WARNING: This API is experimental and may change.
   * This allows more fine-grained control of colors for individual or ranges of characters,
   * taking precedence over the material's `color`. Its format is an Object whose keys each
   * define a starting character index for a range, and whose values are the color for each
   * range. The color value can be a numeric hex color value, a `THREE.Color` object, or
   * any of the strings accepted by `THREE.Color`.
   */
  colorRanges: any;
  /**
   * @member {number|string} outlineWidth
   * WARNING: This API is experimental and may change.
   * The width of an outline/halo to be drawn around each text glyph using the `outlineColor` and `outlineOpacity`.
   * Can be specified as either an absolute number in local units, or as a percentage string e.g.
   * `"12%"` which is treated as a percentage of the `fontSize`. Defaults to `0`, which means
   * no outline will be drawn unless an `outlineOffsetX/Y` or `outlineBlur` is set.
   */
  outlineWidth: number;
  /**
   * @member {string|number|THREE.Color} outlineColor
   * WARNING: This API is experimental and may change.
   * The color of the text outline, if `outlineWidth`/`outlineBlur`/`outlineOffsetX/Y` are set.
   * Defaults to black.
   */
  outlineColor: number;
  /**
   * @member {number} outlineOpacity
   * WARNING: This API is experimental and may change.
   * The opacity of the outline, if `outlineWidth`/`outlineBlur`/`outlineOffsetX/Y` are set.
   * Defaults to `1`.
   */
  outlineOpacity: number;
  /**
   * @member {number|string} outlineBlur
   * WARNING: This API is experimental and may change.
   * A blur radius applied to the outer edge of the text's outline. If the `outlineWidth` is
   * zero, the blur will be applied at the glyph edge, like CSS's `text-shadow` blur radius.
   * Can be specified as either an absolute number in local units, or as a percentage string e.g.
   * `"12%"` which is treated as a percentage of the `fontSize`. Defaults to `0`.
   */
  outlineBlur: number;
  /**
   * @member {number|string} outlineOffsetX
   * WARNING: This API is experimental and may change.
   * A horizontal offset for the text outline.
   * Can be specified as either an absolute number in local units, or as a percentage string e.g. `"12%"`
   * which is treated as a percentage of the `fontSize`. Defaults to `0`.
   */
  outlineOffsetX: number;
  /**
   * @member {number|string} outlineOffsetY
   * WARNING: This API is experimental and may change.
   * A vertical offset for the text outline.
   * Can be specified as either an absolute number in local units, or as a percentage string e.g. `"12%"`
   * which is treated as a percentage of the `fontSize`. Defaults to `0`.
   */
  outlineOffsetY: number;
  /**
   * @member {number|string} strokeWidth
   * WARNING: This API is experimental and may change.
   * The width of an inner stroke drawn inside each text glyph using the `strokeColor` and `strokeOpacity`.
   * Can be specified as either an absolute number in local units, or as a percentage string e.g. `"12%"`
   * which is treated as a percentage of the `fontSize`. Defaults to `0`.
   */
  strokeWidth: number;
  /**
   * @member {string|number|THREE.Color} strokeColor
   * WARNING: This API is experimental and may change.
   * The color of the text stroke, if `strokeWidth` is greater than zero. Defaults to gray.
   */
  strokeColor: number;
  /**
   * @member {number} strokeOpacity
   * WARNING: This API is experimental and may change.
   * The opacity of the stroke, if `strokeWidth` is greater than zero. Defaults to `1`.
   */
  strokeOpacity: number;
  /**
   * @member {number} fillOpacity
   * WARNING: This API is experimental and may change.
   * The opacity of the glyph's fill from 0 to 1. This behaves like the material's `opacity` but allows
   * giving the fill a different opacity than the `strokeOpacity`. A fillOpacity of `0` makes the
   * interior of the glyph invisible, leaving just the `strokeWidth`. Defaults to `1`.
   */
  fillOpacity: number;
  /**
   * @member {number} depthOffset
   * This is a shortcut for setting the material's `polygonOffset` and related properties,
   * which can be useful in preventing z-fighting when this text is laid on top of another
   * plane in the scene. Positive numbers are further from the camera, negatives closer.
   */
  depthOffset: number;
  /**
   * @member {Array<number>} clipRect
   * If specified, defines a `[minX, minY, maxX, maxY]` of a rectangle outside of which all
   * pixels will be discarded. This can be used for example to clip overflowing text when
   * `whiteSpace='nowrap'`.
   */
  clipRect: any;
  /**
   * @member {string} orientation
   * Defines the axis plane on which the text should be laid out when the mesh has no extra
   * rotation transform. It is specified as a string with two axes: the horizontal axis with
   * positive pointing right, and the vertical axis with positive pointing up. By default this
   * is '+x+y', meaning the text sits on the xy plane with the text's top toward positive y
   * and facing positive z. A value of '+x-z' would place it on the xz plane with the text's
   * top toward negative z and facing positive y.
   */
  orientation: string;
  set glyphGeometryDetail(arg: any);
  get glyphGeometryDetail(): any;
  /**
   * @member {number|null} sdfGlyphSize
   * The size of each glyph's SDF (signed distance field) used for rendering. This must be a
   * power-of-two number. Defaults to 64 which is generally a good balance of size and quality
   * for most fonts. Larger sizes can improve the quality of glyph rendering by increasing
   * the sharpness of corners and preventing loss of very thin lines, at the expense of
   * increased memory footprint and longer SDF generation time.
   */
  sdfGlyphSize: any;
  /**
   * @member {boolean} gpuAccelerateSDF
   * When `true`, the SDF generation process will be GPU-accelerated with WebGL when possible,
   * making it much faster especially for complex glyphs, and falling back to a JavaScript version
   * executed in web workers when support isn't available. It should automatically detect support,
   * but it's still somewhat experimental, so you can set it to `false` to force it to use the JS
   * version if you encounter issues with it.
   */
  gpuAccelerateSDF: boolean;
  debugSDF: boolean;
  /**
   * Updates the text rendering according to the current text-related configuration properties.
   * This is an async process, so you can pass in a callback function to be executed when it
   * finishes.
   * @param {function} [callback]
   */
  sync(callback?: Function): void;
  _needsSync: boolean;
  _queuedSyncs: any[];
  _isSyncing: boolean;
  _textRenderInfo: any;

  /**
   * Shortcut to dispose the geometry specific to this instance.
   * Note: we don't also dispose the derived material here because if anything else is
   * sharing the same base material it will result in a pause next frame as the program
   * is recompiled. Instead users can dispose the base material manually, like normal,
   * and we'll also dispose the derived material at that time.
   */
  dispose(): void;
  /**
   * @property {TroikaTextRenderInfo|null} textRenderInfo
   * @readonly
   * The current processed rendering data for this TextMesh, returned by the TextBuilder after
   * a `sync()` call. This will be `null` initially, and may be stale for a short period until
   * the asynchrous `sync()` process completes.
   */
  get textRenderInfo(): any;
  _defaultMaterial: any;
  _derivedMaterial: any;
  _baseMaterial: any;
  _prepareForRender(material: any): void;
  _parsePercent(value: any): any;
  /**
   * Translate a point in local space to an x/y in the text plane.
   */
  localPositionToTextCoords(position: any, target?: any): any;
  /**
   * Translate a point in world space to an x/y in the text plane.
   */
  worldPositionToTextCoords(position: any, target?: any): any;
  /**
   * @override Custom raycasting to test against the whole text block's max rectangular bounds
   * TODO is there any reason to make this more granular, like within individual line or glyph rects?
   */
  override raycast(raycaster: any, intersects: any): void;
  copy(source: any): this;
  geometry: any;
  clone(): any;
}
