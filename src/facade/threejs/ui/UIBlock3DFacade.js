import { Mesh, Vector2, Vector4, PlaneBufferGeometry, Sphere, Matrix4 } from 'three'
import Group3DFacade from '../Group3DFacade'
import UITextNode3DFacade from './UITextNode3DFacade'
import UIBlockLayer3DFacade from './UIBlockLayer3DFacade'
import { extendAsFlexNode } from './FlexNode'
import { getInheritable } from './uiUtils'
import { assign } from '../../../utils'

const raycastMesh = new Mesh(new PlaneBufferGeometry(1, 1).translate(0.5, -0.5, 0))
const tempMat4 = new Matrix4()
const DEFAULT_FONT_SIZE = 16
const DEFAULT_LINE_HEIGHT = 'normal'

/**
 * Represents a single block UI element, essentially just a 2D rectangular block that
 * can contain text, be styled with background/border, and participate in flexbox layout.
 * Its behavior and styling is very much like an HTML element using flexbox.
 */
class UIBlock3DFacade extends Group3DFacade {
  constructor(parent) {
    super(parent)

    // Create rendering layer child definitions
    // These live separate from the main `children` tree
    this.bgLayer = {
      key: 'bg',
      facade: UIBlockLayer3DFacade
    }
    this.borderLayer = {
      key: 'border',
      facade: UIBlockLayer3DFacade,
      isBorder: true
    }
    this.layers = new Group3DFacade(this)
    this.layers.children = [null, null]

    // Create child def for text node
    this.textChild = {
      key: 'text',
      facade: UITextNode3DFacade
    }

    this._sizeVec2 = new Vector2()
    this._clipRectVec4 = new Vector4()
    this._borderWidthVec4 = new Vector4()
    this._borderRadiiVec4 = new Vector4()
    ;(this._geomBoundingSphere = new Sphere()).version = 0
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
      offsetLeft,
      offsetTop,
      offsetWidth,
      offsetHeight,
      parentFlexNode,
      flexNodeDepth,
      _borderWidthVec4,
      _clipRectVec4,
      _sizeVec2
    } = this
    const hasLayout = offsetWidth !== null
    const hasNonZeroSize = !!(offsetWidth && offsetHeight)
    const hasBg = hasNonZeroSize && (backgroundColor != null || backgroundMaterial != null)
    const hasBorder = hasNonZeroSize && (borderColor != null || borderMaterial != null) && Math.max(...borderWidth) > 0

    // Update the block's element and size from flexbox computed values
    if (hasLayout) {
      if (parentFlexNode) {
        this.x = offsetLeft - parentFlexNode.scrollLeft
        this.y = -(offsetTop - parentFlexNode.scrollTop)
      }
      if (offsetWidth !== _sizeVec2.x || offsetHeight !== _sizeVec2.y) {
        _sizeVec2.set(offsetWidth, offsetHeight)

        // Update pre-worldmatrix bounding sphere
        const sphere = this._geomBoundingSphere
        sphere.radius = Math.sqrt(offsetWidth * offsetWidth / 4 + offsetHeight * offsetHeight / 4)
        sphere.center.set(offsetWidth / 2, -offsetHeight / 2, 0)
        sphere.version++
      }
    }

    // Update shared vector objects for the sublayers
    const radii = (hasBg || hasBorder) ? this._normalizeBorderRadius() : null
    _borderWidthVec4.fromArray(borderWidth)
    _clipRectVec4.set(this.clipLeft, this.clipTop, this.clipRight, this.clipBottom)

    // Update rendering layers...
    if (hasBg) {
      bgLayer.size = _sizeVec2
      bgLayer.color = backgroundColor
      bgLayer.borderRadius = radii
      bgLayer.material = backgroundMaterial
      bgLayer.clipRect = _clipRectVec4
      bgLayer.depthOffset = -flexNodeDepth
      // bgLayer.castShadow = this.castShadow
      // bgLayer.receiveShadow = this.receiveShadow
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
      borderLayer.clipRect = _clipRectVec4
      borderLayer.depthOffset = -flexNodeDepth - 1
      // borderLayer.castShadow = this.castShadow
      // borderLayer.receiveShadow = this.receiveShadow
    } else {
      borderLayer = null
    }
    layers.children[1] = borderLayer

    // Allow text to be specified as a single string child
    if (!text && isTextNodeChild(this.children)) {
      text = '' + this.children
    }
    // Update text child...
    if (text) {
      textChild.text = text
      textChild.font = getInheritable(this, 'font')
      textChild.fontSize = getInheritable(this, 'fontSize', DEFAULT_FONT_SIZE)
      textChild.textAlign = getInheritable(this, 'textAlign')
      textChild.lineHeight = getInheritable(this, 'lineHeight', DEFAULT_LINE_HEIGHT)
      textChild.letterSpacing = getInheritable(this, 'letterSpacing', 0)
      textChild.whiteSpace = getInheritable(this, 'whiteSpace')
      textChild.overflowWrap = getInheritable(this, 'overflowWrap')
      textChild.color = getInheritable(this, 'color')
      textChild.material = this.textMaterial
      textChild.depthOffset = -flexNodeDepth - 1
      // textChild.castShadow = this.castShadow
      // textChild.receiveShadow = this.receiveShadow
      this.children = textChild //NOTE: text content will clobber any other defined children
    } else {
      // Convert any children specified as plain strings to nested text blocks; handy for JSX style
      let children = this.children
      if (Array.isArray(children)) {
        for (let i = 0, len = children.length; i < len; i++) {
          if (isTextNodeChild(children[i])) {
            children = this.children = children.slice()
            for (; i < len; i++) { //continue from here
              if (isTextNodeChild(children[i])) {
                children[i] = {
                  facade: UIBlock3DFacade$FlexNode,
                  text: '' + children[i],
                  textMaterial: this.textMaterial
                }
              }
            }
            break
          }
        }
      }
    }

    // Add mousewheel listener if scrollable
    // TODO scroll via drag?
    const canScroll = hasNonZeroSize && (
      this.scrollHeight > this.clientHeight || this.scrollWidth > this.clientWidth
    )
    this[`${canScroll ? 'add' : 'remove'}EventListener`]('wheel', wheelHandler)

    super.afterUpdate()
    layers.afterUpdate()
  }

  _normalizeBorderRadius() {
    const {
      borderRadius:input,
      offsetWidth=0,
      offsetHeight=0,
      _borderRadiiVec4:vec4
    } = this

    // Normalize to four corner values
    let tl, tr, br, bl
    if (Array.isArray(input)) {
      const len = input.length
      tl = input[0] || 0
      tr = (len > 1 ? input[1] : input[0]) || 0
      br = (len > 2 ? input[2] : input[0]) || 0
      bl = (len > 3 ? input[3] : len > 1 ? input[1] : input[0]) || 0
    } else {
      tl = tr = br = bl = input || 0
    }

    if (tl !== 0 || tr !== 0 || br !== 0 || bl !== 0) { //avoid work for common no-radius case
      // Resolve percentages
      const minDimension = Math.min(offsetWidth, offsetHeight)
      if (typeof tl === 'string' && /%$/.test(tl)) {
        tl = parseInt(tl, 10) / 100 * minDimension
      }
      if (typeof tr === 'string' && /%$/.test(tr)) {
        tr = parseInt(tr, 10) / 100 * minDimension
      }
      if (typeof bl === 'string' && /%$/.test(bl)) {
        bl = parseInt(bl, 10) / 100 * minDimension
      }
      if (typeof br === 'string' && /%$/.test(br)) {
        br = parseInt(br, 10) / 100 * minDimension
      }

      // If any radii overlap based on the block's current size, reduce them all by the same ratio, ala CSS3.
      let radiiAdjRatio = Math.min(
        offsetWidth / (tl + tr),
        offsetHeight / (tr + br),
        offsetWidth / (br + bl),
        offsetHeight / (bl + tl)
      )
      if (radiiAdjRatio < 1) {
        tl *= radiiAdjRatio
        tr *= radiiAdjRatio
        bl *= radiiAdjRatio
        br *= radiiAdjRatio
      }
    }

    // Update the Vector4 if anything hanged
    if (tl !== vec4.x || tr !== vec4.y || br !== vec4.z || bl !== vec4.w) {
      vec4.set(tl, tr, br, bl)
    }

    return vec4
  }

  /**
   * @override Use our textGeometry's boundingSphere which we keep updated as we get new
   * layout metrics.
   */
  _getGeometryBoundingSphere() {
    return this._geomBoundingSphere.radius ? this._geomBoundingSphere : null
  }

  /**
   * @override Custom raycaster to test against the layout block
   */
  raycast(raycaster) {
    const {offsetWidth, offsetHeight} = this
    if (offsetWidth && offsetHeight) {
      raycastMesh.matrixWorld.multiplyMatrices(
        this.threeObject.matrixWorld,
        tempMat4.makeScale(offsetWidth, offsetHeight, 1)
      )
      const result = this._raycastObject(raycastMesh, raycaster)
      if (result) {
        // Add a distance bias (used as secondary sort for equidistant intersections) to prevent
        // container blocks from intercepting pointer events for their children. Also apply a
        // slight rounding prevent floating point precision irregularities from reporting different
        // distances for coplanar blocks.
        result.forEach(result => {
          result.distance = parseFloat(result.distance.toFixed(12))
          result.distanceBias = -this.flexNodeDepth
        })
      }
      return result
    }
    return null
  }


  destructor() {
    this.layers.destructor()
    super.destructor()
  }
}

// Extend as FlexNode
const UIBlock3DFacade$FlexNode = UIBlock3DFacade = extendAsFlexNode(UIBlock3DFacade)

assign(UIBlock3DFacade.prototype, {
  font: 'inherit',
  fontSize: 'inherit',
  lineHeight: 'inherit',
  letterSpacing: 'inherit',
  whiteSpace: 'inherit',
  overflowWrap: 'inherit',
  color: 'inherit'
})



function wheelHandler(e) {
  const facade = e.currentTarget
  let {deltaX, deltaY, deltaMode} = e.nativeEvent
  if (deltaMode === 0x01) { //line mode
    const lineSize = getInheritable(facade, 'fontSize', DEFAULT_FONT_SIZE) *
      getInheritable(facade, 'lineHeight', 1.2) //Note: fixed default since we can't resolve 'normal' here
    deltaX *= lineSize
    deltaY *= lineSize
  }
  const scrollLeft = Math.max(0, Math.min(
    facade.scrollWidth - facade.clientWidth,
    facade.scrollLeft + deltaX
  ))
  const scrollTop = Math.max(0, Math.min(
    facade.scrollHeight - facade.clientHeight,
    facade.scrollTop + deltaY
  ))

  // Only scroll if the major scroll direction would actually result in a scroll change
  const abs = Math.abs
  if (
    (scrollLeft !== this.scrollLeft && abs(deltaX) > abs(deltaY)) ||
    (scrollTop !== this.scrollTop && abs(deltaY) > abs(deltaX))
  ) {
    this.scrollLeft = scrollLeft
    this.scrollTop = scrollTop
    e.stopPropagation() //only scroll deepest
  }
  facade.afterUpdate()
  facade.notifyWorld('needsRender')
  e.preventDefault()
}

function isTextNodeChild(child) {
  return typeof child === 'string' || typeof child === 'number'
}



export default UIBlock3DFacade
