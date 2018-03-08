import { Vector2, Vector4 } from 'three'
import Group3DFacade from '../Group3DFacade'
import Text3DFacade from '../text/Text3DFacade'
import { setUpToFourValues } from './uiUtils'
import UIBlockLayer3DFacade from './UIBlockLayer3DFacade'
import { makeFlexLayoutNode } from './FlexLayoutNode'
import ParentFacade from '../../ParentFacade'
import { createThenable } from '../../../utils'
import { getTextRenderInfo } from '../text/TextBuilder'


const ZERO_SIZE = Object.freeze({width: 0, height: 0})


/**
 * Represents a single block UI element, essentially just a 2D rectangular block that
 * can contain text, be styled with background/border, and participate in flexbox layout.
 * Its behavior and styling is very much like an HTML element using flexbox.
 */
class UIBlock3DFacade extends makeFlexLayoutNode(Group3DFacade) {
  constructor(parent) {
    super(parent)

    // Create rendering layer child definitions
    // These live separate from the main `children` tree
    const depth = this.flexNodeDepth
    this.bgLayer = {
      key: 'bg',
      facade: UIBlockLayer3DFacade,
      depthOffset: -depth
    }
    this.borderLayer = {
      key: 'border',
      facade: UIBlockLayer3DFacade,
      isBorder: true,
      depthOffset: -depth - 1
    }
    this.layers = new ParentFacade(this)
    this.layers.children = [null, null]

    // Create child def for text node
    this.textChild = {
      key: 'text',
      facade: TextFlexNode3DFacade,
      depthOffset: -depth - 2
    }

    // Defaults
    this.width = this.height = 'auto'
    this.color = 0xffffff
    //this.maxWidth = Infinity

    this._sizeVec2 = new Vector2()
    this._borderWidthVec4 = new Vector4()
    this._borderRadiiVec4 = new Vector4()
  }

  afterUpdate() {
    let {
      bgLayer,
      borderLayer,
      textChild,
      layers,
      backgroundColor,
      backgroundMaterial,
      borderWidth,
      borderColor,
      borderMaterial,
      text,
      color,
      textMaterial,
      computedLeft,
      computedTop,
      computedWidth,
      computedHeight,
      _borderWidthVec4,
      _sizeVec2
    } = this
    const hasLayout = typeof computedWidth === 'number'
    const hasBg = hasLayout && (backgroundColor != null || backgroundMaterial != null)
    const hasBorder = hasLayout && borderWidth && (borderColor != null || borderMaterial != null)
    const hasText = !!text

    // Update the block's element and size from flexbox computed values
    // TODO pass left/top as uniforms to avoid matrix recalcs
    this.x = computedLeft
    this.y = -computedTop
    _sizeVec2.set(computedWidth || 0, computedHeight || 0)

    // Get normalized border radii Vector4
    const radii = this._normalizeBorderRadius()

    // Get normalized border widths Vector4
    //if (borderWidth !== _borderWidthVec4._srcArray) {
      _borderWidthVec4.fromArray(borderWidth)
    //  _borderWidthVec4._srcArray = borderWidth
    //}

    // Update rendering layers...
    if (hasBg) {
      bgLayer.size = _sizeVec2
      bgLayer.color = backgroundColor
      bgLayer.borderRadius = radii
      bgLayer.material = backgroundMaterial
    } else {
      bgLayer = null
    }
    layers.children[0] = bgLayer

    if (hasBorder) {
      borderLayer.size = _sizeVec2
      borderLayer.color = borderColor
      borderLayer.borderWidth = _borderWidthVec4
      borderLayer.borderRadius = radii
      borderLayer.material = borderMaterial
    } else {
      borderLayer = null
    }
    layers.children[1] = borderLayer

    // Update text child...
    if (hasText) {
      textChild.visible = hasLayout
      textChild.text = text
      textChild.font = this.font
      textChild.fontSize = this.fontSize
      textChild.textAlign = this.textAlign
      textChild.lineHeight = this.lineHeight
      textChild.letterSpacing = this.letterSpacing
      textChild.color = color
      textChild.material = textMaterial
      this.children = textChild //NOTE: text content will clobber any other defined children
    }

    super.afterUpdate()
    layers.afterUpdate()
  }

  _normalizeBorderRadius() {
    const {borderRadius, computedWidth, computedHeight, _borderRadiiVec4:vec4} = this

    // Normalize 1-to-4-element value into a Vector4
    setUpToFourValues(vec4, borderRadius)

    // If any radii overlap based on the block's current size, reduce them all by the same ratio, ala CSS3.
    let radiiAdjRatio = Math.min(
      computedWidth / (vec4.x + vec4.y),
      computedHeight / (vec4.y + vec4.z),
      computedWidth / (vec4.z + vec4.w),
      computedHeight / (vec4.w + vec4.x)
    )
    if (radiiAdjRatio < 1) {
      vec4.multiplyScalar(radiiAdjRatio)
    }
    return vec4
  }

/*
  onNotifyWorld(source, message, data) {
    if (message === 'textSizeChanged') {
      // this._textWidth = data[0]
      // this._textHeight = data[1]
      // if (this.width === 'auto' || this.height === 'auto') {
      //   this.afterUpdate()
      //   this.notifyWorld('needsRender')
      // }
      // return
      // TODO is this necessary, or will the FlexLayout have already handled it?
    }
    super.onNotifyWorld(source, message, data)
  }
*/

  destructor() {
    this.layers.destructor()
    super.destructor()
  }
}

/**
 * Wrapper for Text3DFacade that lets it act as a flex layout node.
 */
class TextFlexNode3DFacade extends makeFlexLayoutNode(Text3DFacade) {
  /**
   * @overrides FlexLayoutNode#measureIntrinsicSize
   * @param maxWidth
   * @return {Readonly<{width: number, height: number}>|{then}}
   */
  measureIntrinsicSize(maxWidth) {
    // Check for a cached result
    let cache = this._measureCache
    if (cache && (maxWidth in cache)) {
      return cache[maxWidth]
    } else {
      const thenable = createThenable()
      getTextRenderInfo({
        text: this.text,
        font: this.font,
        fontSize: this.fontSize,
        letterSpacing: this.letterSpacing,
        lineHeight: this.lineHeight,
        maxWidth: maxWidth,
        metricsOnly: true
      }, ({totalBlockSize}) => {
        if (!cache) {
          cache = this._measureCache = Object.create(null)
        }
        cache[maxWidth] = Object.freeze({width: totalBlockSize[0], height: totalBlockSize[1]})
        thenable.resolve()
      })
      return thenable
    }
  }

  afterUpdate() {
    // Read computed layout
    const {
      computedLeft,
      computedTop,
      computedWidth
    } = this
    const hasLayout = typeof computedLeft === 'number'

    this.x = computedLeft || 0
    this.y = -computedTop || 0
    this.maxWidth = hasLayout ? computedWidth : Infinity

    super.afterUpdate()
  }
}
// Redefine the maxWidth property so it's not treated as a flex layout affecting prop
Object.defineProperty(TextFlexNode3DFacade.prototype, 'maxWidth', {
  value: Infinity,
  enumerable: true,
  writable: true
})



export default UIBlock3DFacade
