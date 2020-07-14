import {
  DoubleSide,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneBufferGeometry,
  Vector3
} from 'three'
import { GlyphsGeometry } from './GlyphsGeometry.js'
import { createTextDerivedMaterial } from './TextDerivedMaterial.js'
import { getTextRenderInfo } from './TextBuilder.js'



const defaultMaterial = new MeshBasicMaterial({
  color: 0xffffff,
  side: DoubleSide,
  transparent: true
})

const tempMat4 = new Matrix4()
const tempVec3a = new Vector3()
const tempVec3b = new Vector3()
const tempArray = []
const origin = new Vector3()
const defaultOrient = '+x+y'

const raycastMesh = new Mesh(
  new PlaneBufferGeometry(1, 1).translate(0.5, 0.5, 0),
  defaultMaterial
)

const syncStartEvent = {type: 'syncstart'}
const syncCompleteEvent = {type: 'synccomplete'}

const SYNCABLE_PROPS = [
  'font',
  'fontSize',
  'letterSpacing',
  'lineHeight',
  'maxWidth',
  'overflowWrap',
  'text',
  'textAlign',
  'textIndent',
  'whiteSpace',
  'anchorX',
  'anchorY',
  'colorRanges',
  'sdfGlyphSize'
]

const COPYABLE_PROPS = SYNCABLE_PROPS.concat(
  'material',
  'color',
  'depthOffset',
  'clipRect',
  'orientation',
  'glyphGeometryDetail'
)



/**
 * @class Text
 *
 * A ThreeJS Mesh that renders a string of text on a plane in 3D space using signed distance
 * fields (SDF).
 */
class Text extends Mesh {
  constructor() {
    const geometry = new GlyphsGeometry()
    super(geometry, null)

    // === Text layout properties: === //

    /**
     * @member {string} text
     * The string of text to be rendered.
     */
    this.text = ''

    /**
     * @deprecated Use `anchorX` and `anchorY` instead
     * @member {Array<number>} anchor
     * Defines where in the text block should correspond to the mesh's local position, as a set
     * of horizontal and vertical percentages from 0 to 1. A value of `[0, 0]` (the default)
     * anchors at the top-left, `[1, 1]` at the bottom-right, and `[0.5, 0.5]` centers the
     * block at the mesh's position.
     */
    //this.anchor = null

    /**
     * @member {number|string} anchorX
     * Defines the horizontal position in the text block that should line up with the local origin.
     * Can be specified as a numeric x position in local units, a string percentage of the total
     * text block width e.g. `'25%'`, or one of the following keyword strings: 'left', 'center',
     * or 'right'.
     */
    this.anchorX = 0

    /**
     * @member {number|string} anchorX
     * Defines the vertical position in the text block that should line up with the local origin.
     * Can be specified as a numeric y position in local units (note: down is negative y), a string
     * percentage of the total text block height e.g. `'25%'`, or one of the following keyword strings:
     * 'top', 'top-baseline', 'middle', 'bottom-baseline', or 'bottom'.
     */
    this.anchorY = 0

    /**
     * @member {string} font
     * URL of a custom font to be used. Font files can be any of the formats supported by
     * OpenType (see https://github.com/opentypejs/opentype.js).
     * Defaults to the Roboto font loaded from Google Fonts.
     */
    this.font = null //will use default from TextBuilder

    /**
     * @member {number} fontSize
     * The size at which to render the font in local units; corresponds to the em-box height
     * of the chosen `font`.
     */
    this.fontSize = 0.1

    /**
     * @member {number} letterSpacing
     * Sets a uniform adjustment to spacing between letters after kerning is applied. Positive
     * numbers increase spacing and negative numbers decrease it.
     */
    this.letterSpacing = 0

    /**
     * @member {number|string} lineHeight
     * Sets the height of each line of text, as a multiple of the `fontSize`. Defaults to 'normal'
     * which chooses a reasonable height based on the chosen font's ascender/descender metrics.
     */
    this.lineHeight = 'normal'

    /**
     * @member {number} maxWidth
     * The maximum width of the text block, above which text may start wrapping according to the
     * `whiteSpace` and `overflowWrap` properties.
     */
    this.maxWidth = Infinity

    /**
     * @member {string} overflowWrap
     * Defines how text wraps if the `whiteSpace` property is `normal`. Can be either `'normal'`
     * to break at whitespace characters, or `'break-word'` to allow breaking within words.
     * Defaults to `'normal'`.
     */
    this.overflowWrap = 'normal'

    /**
     * @member {string} textAlign
     * The horizontal alignment of each line of text within the overall text bounding box.
     */
    this.textAlign = 'left'

    /**
     * @member {number} textIndent
     * Indentation for the first character of a line; see CSS `text-indent`.
     */
    this.textIndent = 0

    /**
     * @member {string} whiteSpace
     * Defines whether text should wrap when a line reaches the `maxWidth`. Can
     * be either `'normal'` (the default), to allow wrapping according to the `overflowWrap` property,
     * or `'nowrap'` to prevent wrapping. Note that `'normal'` here honors newline characters to
     * manually break lines, making it behave more like `'pre-wrap'` does in CSS.
     */
    this.whiteSpace = 'normal'


    // === Presentation properties: === //

    /**
     * @member {THREE.Material} material
     * Defines a _base_ material to be used when rendering the text. This material will be
     * automatically replaced with a material derived from it, that adds shader code to
     * decrease the alpha for each fragment (pixel) outside the text glyphs, with antialiasing.
     * By default it will derive from a simple white MeshBasicMaterial, but you can use any
     * of the other mesh materials to gain other features like lighting, texture maps, etc.
     *
     * Also see the `color` shortcut property.
     */
    this.material = null

    /**
     * @member {string|number|THREE.Color} color
     * This is a shortcut for setting the `color` of the text's material. You can use this
     * if you don't want to specify a whole custom `material`.
     */
    this.color = null

    /**
     * @member {object|null} colorRanges
     * WARNING: This API is experimental and may change.
     * This allows more fine-grained control of colors for individual or ranges of characters,
     * taking precedence over the material's `color`. Its format is an Object whose keys each
     * define a starting character index for a range, and whose values are the color for each
     * range. The color value can be a numeric hex color value, a `THREE.Color` object, or
     * any of the strings accepted by `THREE.Color`.
     */
    this.colorRanges = null

    /**
     * @member {number} depthOffset
     * This is a shortcut for setting the material's `polygonOffset` and related properties,
     * which can be useful in preventing z-fighting when this text is laid on top of another
     * plane in the scene. Positive numbers are further from the camera, negatives closer.
     */
    this.depthOffset = 0

    /**
     * @member {Array<number>} clipRect
     * If specified, defines a `[minX, minY, maxX, maxY]` of a rectangle outside of which all
     * pixels will be discarded. This can be used for example to clip overflowing text when
     * `whiteSpace='nowrap'`.
     */
    this.clipRect = null

    /**
     * @member {string} orientation
     * Defines the axis plane on which the text should be laid out when the mesh has no extra
     * rotation transform. It is specified as a string with two axes: the horizontal axis with
     * positive pointing right, and the vertical axis with positive pointing up. By default this
     * is '+x+y', meaning the text sits on the xy plane with the text's top toward positive y
     * and facing positive z. A value of '+x-z' would place it on the xz plane with the text's
     * top toward negative z and facing positive y.
     */
    this.orientation = defaultOrient

    /**
     * @member {number} glyphGeometryDetail
     * Controls number of vertical/horizontal segments that make up each glyph's rectangular
     * plane. Defaults to 1. This can be increased to provide more geometrical detail for custom
     * vertex shader effects, for example.
     */
    this.glyphGeometryDetail = 1

    /**
     * @member {number|null} sdfGlyphSize
     * The size of each glyph's SDF (signed distance field) used for rendering. This must be a
     * power-of-two number. Defaults to 64 which is generally a good balance of size and quality
     * for most fonts. Larger sizes can improve the quality of glyph rendering by increasing
     * the sharpness of corners and preventing loss of very thin lines, at the expense of
     * increased memory footprint and longer SDF generation time.
     */
    this.sdfGlyphSize = null

    this.debugSDF = false
  }

  /**
   * Updates the text rendering according to the current text-related configuration properties.
   * This is an async process, so you can pass in a callback function to be executed when it
   * finishes.
   * @param {function} [callback]
   */
  sync(callback) {
    if (this._needsSync) {
      this._needsSync = false

      // If there's another sync still in progress, queue
      if (this._isSyncing) {
        (this._queuedSyncs || (this._queuedSyncs = [])).push(callback)
      } else {
        this._isSyncing = true
        this.dispatchEvent(syncStartEvent)

        getTextRenderInfo({
          text: this.text,
          font: this.font,
          fontSize: this.fontSize || 0.1,
          letterSpacing: this.letterSpacing || 0,
          lineHeight: this.lineHeight || 'normal',
          maxWidth: this.maxWidth,
          textAlign: this.textAlign,
          textIndent: this.textIndent,
          whiteSpace: this.whiteSpace,
          overflowWrap: this.overflowWrap,
          anchorX: this.anchorX,
          anchorY: this.anchorY,
          colorRanges: this.colorRanges,
          includeCaretPositions: true, //TODO parameterize
          sdfGlyphSize: this.sdfGlyphSize
        }, textRenderInfo => {
          this._isSyncing = false

          // Save result for later use in onBeforeRender
          this._textRenderInfo = textRenderInfo

          // Update the geometry attributes
          this.geometry.updateGlyphs(
            textRenderInfo.glyphBounds,
            textRenderInfo.glyphAtlasIndices,
            textRenderInfo.totalBounds,
            textRenderInfo.chunkedBounds,
            textRenderInfo.glyphColors
          )

          // If we had extra sync requests queued up, kick it off
          const queued = this._queuedSyncs
          if (queued) {
            this._queuedSyncs = null
            this._needsSync = true
            this.sync(() => {
              queued.forEach(fn => fn && fn())
            })
          }

          this.dispatchEvent(syncCompleteEvent)
          if (callback) {
            callback()
          }
        })
      }
    }
  }

  /**
   * Initiate a sync if needed - note it won't complete until next frame at the
   * earliest so if possible it's a good idea to call sync() manually as soon as
   * all the properties have been set.
   * @override
   */
  onBeforeRender() {
    this.sync()
    this._prepareForRender()
  }

  /**
   * Shortcut to dispose the geometry specific to this instance.
   * Note: we don't also dispose the derived material here because if anything else is
   * sharing the same base material it will result in a pause next frame as the program
   * is recompiled. Instead users can dispose the base material manually, like normal,
   * and we'll also dispose the derived material at that time.
   */
  dispose() {
    this.geometry.dispose()
  }

  /**
   * @property {TroikaTextRenderInfo|null} textRenderInfo
   * @readonly
   * The current processed rendering data for this TextMesh, returned by the TextBuilder after
   * a `sync()` call. This will be `null` initially, and may be stale for a short period until
   * the asynchrous `sync()` process completes.
   */
  get textRenderInfo() {
    return this._textRenderInfo || null
  }

  // Handler for automatically wrapping the base material with our upgrades. We do the wrapping
  // lazily on _read_ rather than write to avoid unnecessary wrapping on transient values.
  get material() {
    let derivedMaterial = this._derivedMaterial
    const baseMaterial = this._baseMaterial || defaultMaterial
    if (!derivedMaterial || derivedMaterial.baseMaterial !== baseMaterial) {
      derivedMaterial = this._derivedMaterial = createTextDerivedMaterial(baseMaterial)
      // dispose the derived material when its base material is disposed:
      baseMaterial.addEventListener('dispose', function onDispose() {
        baseMaterial.removeEventListener('dispose', onDispose)
        derivedMaterial.dispose()
      })
    }
    return derivedMaterial
  }
  set material(baseMaterial) {
    if (baseMaterial && baseMaterial.isTroikaTextMaterial) { //prevent double-derivation
      this._derivedMaterial = baseMaterial
      this._baseMaterial = baseMaterial.baseMaterial
    } else {
      this._baseMaterial = baseMaterial
    }
  }

  get glyphGeometryDetail() {
    return this.geometry.detail
  }
  set glyphGeometryDetail(detail) {
    this.geometry.detail = detail
  }

  // Create and update material for shadows upon request:
  get customDepthMaterial() {
    return this.material.getDepthMaterial()
  }
  get customDistanceMaterial() {
    return this.material.getDistanceMaterial()
  }

  _prepareForRender() {
    const material = this._derivedMaterial
    const uniforms = material.uniforms
    const textInfo = this.textRenderInfo
    if (textInfo) {
      const {sdfTexture, totalBounds} = textInfo
      uniforms.uTroikaSDFTexture.value = sdfTexture
      uniforms.uTroikaSDFTextureSize.value.set(sdfTexture.image.width, sdfTexture.image.height)
      uniforms.uTroikaSDFGlyphSize.value = textInfo.sdfGlyphSize
      uniforms.uTroikaSDFMinDistancePct.value = textInfo.sdfMinDistancePercent
      uniforms.uTroikaTotalBounds.value.fromArray(totalBounds)
      uniforms.uTroikaUseGlyphColors.value = !!textInfo.glyphColors

      let clipRect = this.clipRect
      if (!(clipRect && Array.isArray(clipRect) && clipRect.length === 4)) {
        uniforms.uTroikaClipRect.value.fromArray(totalBounds)
      } else {
        uniforms.uTroikaClipRect.value.set(
          Math.max(totalBounds[0], clipRect[0]),
          Math.max(totalBounds[1], clipRect[1]),
          Math.min(totalBounds[2], clipRect[2]),
          Math.min(totalBounds[3], clipRect[3])
        )
      }
      this.geometry.applyClipRect(uniforms.uTroikaClipRect.value)
    }
    uniforms.uTroikaSDFDebug.value = !!this.debugSDF
    material.polygonOffset = !!this.depthOffset
    material.polygonOffsetFactor = material.polygonOffsetUnits = this.depthOffset || 0

    // shortcut for setting material color via `color` prop on the mesh:
    const color = this.color
    if (color != null && material.color && material.color.isColor && color !== material._troikaColor) {
      material.color.set(material._troikaColor = color)
    }

    // base orientation
    let orient = this.orientation || defaultOrient
    if (orient !== material._orientation) {
      let rotMat = uniforms.uTroikaOrient.value
      orient = orient.replace(/[^-+xyz]/g, '')
      let match = orient !== defaultOrient && orient.match(/^([-+])([xyz])([-+])([xyz])$/)
      if (match) {
        let [, hSign, hAxis, vSign, vAxis] = match
        tempVec3a.set(0, 0, 0)[hAxis] = hSign === '-' ? 1 : -1
        tempVec3b.set(0, 0, 0)[vAxis] = vSign === '-' ? -1 : 1
        tempMat4.lookAt(origin, tempVec3a.cross(tempVec3b), tempVec3b)
        rotMat.setFromMatrix4(tempMat4)
      } else {
        rotMat.identity()
      }
      material._orientation = orient
    }
  }

  /**
   * @override Custom raycasting to test against the whole text block's max rectangular bounds
   * TODO is there any reason to make this more granular, like within individual line or glyph rects?
   */
  raycast(raycaster, intersects) {
    const textInfo = this.textRenderInfo
    if (textInfo) {
      const bounds = textInfo.totalBounds
      raycastMesh.matrixWorld.multiplyMatrices(
        this.matrixWorld,
        tempMat4.set(
          bounds[2] - bounds[0], 0, 0, bounds[0],
          0, bounds[3] - bounds[1], 0, bounds[1],
          0, 0, 1, 0,
          0, 0, 0, 1
        )
      )
      tempArray.length = 0
      raycastMesh.raycast(raycaster, tempArray)
      for (let i = 0; i < tempArray.length; i++) {
        tempArray[i].object = this
        intersects.push(tempArray[i])
      }
    }
  }

  copy(source) {
    super.copy(source)
    COPYABLE_PROPS.forEach(prop => {
      this[prop] = source[prop]
    })
    return this
  }

  clone() {
    return new this.constructor().copy(this)
  }
}


// Create setters for properties that affect text layout:
SYNCABLE_PROPS.forEach(prop => {
  const privateKey = '_private_' + prop
  Object.defineProperty(Text.prototype, prop, {
    get() {
      return this[privateKey]
    },
    set(value) {
      if (value !== this[privateKey]) {
        this[privateKey] = value
        this._needsSync = true
      }
    }
  })
})


// Deprecation handler for `anchor` array:
let deprMsgShown = false
Object.defineProperty(Text.prototype, 'anchor', {
  get() {
    return this._deprecated_anchor
  },
  set(val) {
    this._deprecated_anchor = val
    if (!deprMsgShown) {
      console.warn('TextMesh: `anchor` has been deprecated; use `anchorX` and `anchorY` instead.')
      deprMsgShown = true
    }
    if (Array.isArray(val)) {
      this.anchorX = `${(+val[0] || 0) * 100}%`
      this.anchorY = `${(+val[1] || 0) * 100}%`
    } else {
      this.anchorX = this.anchorY = 0
    }
  }
})




export {Text}




