import {
  DoubleSide,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneBufferGeometry
} from 'three'
import { GlyphsGeometry } from './GlyphsGeometry.js'
import { createTextDerivedMaterial } from './TextDerivedMaterial.js'
import { getTextRenderInfo } from '../TextBuilder.js'



const defaultMaterial = new MeshBasicMaterial({
  color: 0xffffff,
  side: DoubleSide,
  transparent: true
})

const tempMat4 = new Matrix4()

const raycastMesh = new Mesh(
  new PlaneBufferGeometry(1, 1).translate(0.5, 0.5, 0),
  defaultMaterial
)



/**
 * @class TextMesh
 *
 * A ThreeJS Mesh that renders a string of text on a plane in 3D space using signed distance
 * fields (SDF).
 */
class TextMesh extends Mesh {
  constructor(material) {
    const geometry = new GlyphsGeometry()
    super(geometry, null)

    // === Text layout properties: === //

    /**
     * @member {string} text
     * The string of text to be rendered.
     */
    this.text = ''

    /**
     * @member {Array<number>} anchor
     * Defines where in the text block should correspond to the mesh's local position, as a set
     * of horizontal and vertical percentages from 0 to 1. A value of `[0, 0]` (the default)
     * anchors at the top-left, `[1, 1]` at the bottom-right, and `[0.5, 0.5]` centers the
     * block at the mesh's position.
     */
    this.anchor = null

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

        getTextRenderInfo({
          text: this.text,
          font: this.font,
          fontSize: this.fontSize,
          letterSpacing: this.letterSpacing,
          lineHeight: this.lineHeight,
          maxWidth: this.maxWidth,
          textAlign: this.textAlign,
          whiteSpace: this.whiteSpace,
          overflowWrap: this.overflowWrap,
          anchor: this.anchor,
          includeCaretPositions: true //TODO parameterize
        }, textRenderInfo => {
          this._isSyncing = false

          // Save result for later use in onBeforeRender
          this._textRenderInfo = textRenderInfo

          // Update the geometry attributes
          this.geometry.updateGlyphs(textRenderInfo.glyphBounds, textRenderInfo.glyphAtlasIndices, textRenderInfo.totalBounds)

          // If we had extra sync requests queued up, kick it off
          const queued = this._queuedSyncs
          if (queued) {
            this._queuedSyncs = null
            this._needsSync = true
            this.sync(() => {
              queued.forEach(fn => fn && fn())
            })
          }

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
    this._prepareMaterial()
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
      if (derivedMaterial) {
        derivedMaterial.dispose()
      }
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
    this._baseMaterial = baseMaterial
  }

  // Create and update material for shadows upon request:
  get customDepthMaterial() {
    return this._updateLayoutUniforms(this.material.getDepthMaterial())
  }
  get customDistanceMaterial() {
    return this._updateLayoutUniforms(this.material.getDistanceMaterial())
  }

  _prepareMaterial() {
    const material = this._derivedMaterial
    this._updateLayoutUniforms(material)

    // presentation uniforms:
    const uniforms = material.uniforms
    uniforms.uTroikaSDFDebug.value = !!this.debugSDF
    material.polygonOffset = !!this.depthOffset
    material.polygonOffsetFactor = material.polygonOffsetUnits = this.depthOffset || 0

    // shortcut for setting material color via facade prop:
    const color = this.color
    if (color != null && material.color && material.color.isColor && color !== material._troikaColor) {
      material.color.set(material._troikaColor = color)
    }
  }

  _updateLayoutUniforms(material) {
    const textInfo = this.textRenderInfo
    const uniforms = material.uniforms
    if (textInfo) {
      const {sdfTexture, totalBounds} = textInfo
      uniforms.uTroikaSDFTexture.value = sdfTexture
      uniforms.uTroikaSDFTextureSize.value.set(sdfTexture.image.width, sdfTexture.image.height)
      uniforms.uTroikaSDFGlyphSize.value = textInfo.sdfGlyphSize
      uniforms.uTroikaSDFMinDistancePct.value = textInfo.sdfMinDistancePercent
      uniforms.uTroikaTotalBounds.value.fromArray(totalBounds)

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
    }
    return material
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
      raycastMesh.raycast(raycaster, intersects)
    }
  }

}


// Create setters for properties that affect text layout:
const SYNCABLE_PROPS = [
  'font',
  'fontSize',
  'letterSpacing',
  'lineHeight',
  'maxWidth',
  'overflowWrap',
  'text',
  'textAlign',
  'whiteSpace',
  'anchor'
]
SYNCABLE_PROPS.forEach(prop => {
  const privateKey = '_private_' + prop
  Object.defineProperty(TextMesh.prototype, prop, {
    get: function() {
      return this[privateKey]
    },
    set: prop === 'anchor'
      ? function(value) {
        if (JSON.stringify(value) !== JSON.stringify(this[privateKey])) {
          this[privateKey] = value
          this._needsSync = true
        }
      }
      : function(value) {
        if (value !== this[privateKey]) {
          this[privateKey] = value
          this._needsSync = true
        }
      }
  })
})



export {TextMesh}




