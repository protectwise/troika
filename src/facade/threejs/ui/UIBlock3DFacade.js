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
const DEFAULT_LINE_HEIGHT = 1.15

/**
 * Represents a single block UI element, essentially just a 2D rectangular block that
 * can contain text, be styled with background/border, and participate in flexbox layout.
 * Its behavior and styling is very much like an HTML element using flexbox.
 */
class UIBlock3DFacade extends extendAsFlexNode(Group3DFacade) {
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
    this.layers = new Group3DFacade(this)
    this.layers.children = [null, null]

    // Create child def for text node
    this.textChild = {
      key: 'text',
      facade: UITextNode3DFacade,
      depthOffset: -depth - 2,
      clipRect: [0, 0, 0, 0]
    }

    this._sizeVec2 = new Vector2()
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
      textMaterial,
      offsetLeft,
      offsetTop,
      offsetWidth,
      offsetHeight,
      _borderWidthVec4,
      _sizeVec2
    } = this
    const hasLayout = offsetWidth !== null
    const hasNonZeroSize = !!(offsetWidth && offsetHeight)
    const hasBg = hasNonZeroSize && (backgroundColor != null || backgroundMaterial != null)
    const hasBorder = hasNonZeroSize && (borderColor != null || borderMaterial != null) && Math.max(...borderWidth) > 0
    const hasText = !!text

    // Update the block's element and size from flexbox computed values
    // TODO pass left/top as uniforms to avoid matrix recalcs
    if (hasLayout) {
      if (this.parentFlexNode) {
        this.x = offsetLeft
        this.y = -offsetTop
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

    // Get normalized border radii Vector4
    const radii = (hasBg || hasBorder) ? this._normalizeBorderRadius() : null

    // Get normalized border widths Vector4
    _borderWidthVec4.fromArray(borderWidth)

    // Update rendering layers...
    if (hasBg) {
      bgLayer.size = _sizeVec2
      bgLayer.color = backgroundColor
      bgLayer.borderRadius = radii
      bgLayer.material = backgroundMaterial
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
      // borderLayer.castShadow = this.castShadow
      // borderLayer.receiveShadow = this.receiveShadow
    } else {
      borderLayer = null
    }
    layers.children[1] = borderLayer

    // Update text child...
    if (hasText) {
      textChild.text = text
      textChild.font = getInheritable(this, 'font')
      textChild.fontSize = getInheritable(this, 'fontSize', DEFAULT_FONT_SIZE)
      textChild.textAlign = getInheritable(this, 'textAlign')
      textChild.lineHeight = getInheritable(this, 'lineHeight', DEFAULT_LINE_HEIGHT)
      textChild.letterSpacing = getInheritable(this, 'letterSpacing', 0)
      textChild.whiteSpace = getInheritable(this, 'whiteSpace')
      textChild.overflowWrap = getInheritable(this, 'overflowWrap')
      textChild.color = getInheritable(this, 'color')
      textChild.material = textMaterial
      // textChild.castShadow = this.castShadow
      // textChild.receiveShadow = this.receiveShadow
      this.children = textChild //NOTE: text content will clobber any other defined children
    }

    // Add mousewheel listener if scrollable
    const canScroll = this.scrollHeight > this.clientHeight
    this.onWheel = canScroll ? wheelHandler : null
    // TODO scroll via drag:
    // this.onDragStart = canScroll ? dragStartHandler : null
    // this.onDrag = canScroll ? dragHandler : null
    // this.onDragEnd = canScroll ? dragEndHandler : null

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
        // container blocks from intercepting pointer events for their children
        result.forEach(result => {
          result.distanceBias = -this._flexNodeDepth
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
      getInheritable(facade, 'lineHeight', DEFAULT_LINE_HEIGHT)
    deltaX *= lineSize
    deltaY *= lineSize
  }
  facade.scrollLeft = Math.max(0, Math.min(
    facade.scrollWidth - facade.clientWidth,
    facade.scrollLeft + deltaX
  ))
  facade.scrollTop = Math.max(0, Math.min(
    facade.scrollHeight - facade.clientHeight,
    facade.scrollTop + deltaY
  ))
  facade.afterUpdate()
  facade.notifyWorld('needsRender')
  e.preventDefault()
}



export default UIBlock3DFacade
