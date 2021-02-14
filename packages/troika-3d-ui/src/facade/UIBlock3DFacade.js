import { Mesh, Vector2, Vector3, Vector4, PlaneBufferGeometry, Sphere, Matrix4, Plane } from 'three'
import { Group3DFacade } from 'troika-3d'
import UITextNode3DFacade from './UITextNode3DFacade.js'
import UIBlockLayer3DFacade from './UIBlockLayer3DFacade.js'
import { extendAsFlexNode } from '../flex-layout/FlexNode.js'
import { getComputedFontSize, getInheritable, INHERITABLES } from '../uiUtils.js'
import ScrollbarsFacade from './ScrollbarsFacade.js'
import { invertMatrix4 } from 'troika-three-utils'

const raycastMesh = new Mesh(new PlaneBufferGeometry(1, 1).translate(0.5, -0.5, 0))
const tempMat4 = new Matrix4()
const tempVec4 = new Vector4(0,0,0,0)
const emptyVec4 = Object.freeze(new Vector4(0,0,0,0))
const tempPlane = new Plane()
const DEFAULT_FONT_SIZE = 16
const DEFAULT_LINE_HEIGHT = 'normal'

const groupVisiblePropDef = {
  get() {
    return !this._priv_hidden && !this.$facade.isFullyClipped
  },
  set(value) {
    this._priv_hidden = !value
  }
}

/**
 * Represents a single block UI element, essentially just a 2D rectangular block that
 * can contain text, be styled with background/border, and participate in flexbox layout.
 * Its behavior and styling is very much like an HTML element using flexbox.
 */
class UIBlock3DFacade extends Group3DFacade {
  constructor(parent) {
    super(parent)

    // If fully hidden by parent clipping rect, cull the whole Group out of the scene
    Object.defineProperty(this.threeObject, 'visible', groupVisiblePropDef)

    // Anonymous container for bg/border/scrollbar child objects; these live separate
    // from the main `children` tree
    this.layers = new Group3DFacade(this)
    this.layers.children = [null, null, null]

    // Shared objects for passing down to layers - treated as immutable
    this._sizeVec2 = Object.freeze(new Vector2())
    this._clipRectVec4 = emptyVec4
    this._borderWidthVec4 = emptyVec4
    this._borderRadiiVec4 = emptyVec4

    ;(this._geomBoundingSphere = new Sphere()).version = 0
    this._wasFullyClipped = true
  }

  /**
   * @override When fully clipped out of view, skip updating children entirely. We do this by
   * overriding `updateChildren` instead of using the `shouldUpdateChildren` hook, because the
   * latter would still traverse the child tree to sync matrices, which we don't need here.
   * TODO this doesn't work so well when descendants are absolutely positioned or overflow outside our bounds
   */
  updateChildren(children) {
    if (!this.isFullyClipped || !this._wasFullyClipped) {
      super.updateChildren(children)
    }
  }

  updateMatrices() {
    super.updateMatrices()
    this.layers.traverse(updateMatrices)
  }

  afterUpdate() {
    let {
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
      isFullyClipped,
      _wasFullyClipped,
      _borderWidthVec4,
      _clipRectVec4,
      _sizeVec2
    } = this
    const hasLayout = offsetWidth !== null
    const hasNonZeroSize = !!(offsetWidth && offsetHeight)
    const hasBg = hasNonZeroSize && !isFullyClipped && (backgroundColor != null || backgroundMaterial != null)
    const hasBorder = hasNonZeroSize && !isFullyClipped && (borderColor != null || borderMaterial != null) && Math.max(...borderWidth) > 0
    const canScroll = hasNonZeroSize && (this.overflow === 'scroll' || this.overflow === 'auto') && (
      this.scrollHeight > this.clientHeight || this.scrollWidth > this.clientWidth
    )

    // Update the block's element and size from flexbox computed values
    if (hasLayout) {
      if (parentFlexNode) {
        const isAbsPos = this.position === 'absolute'
        this.x = offsetLeft - (isAbsPos ? 0 : parentFlexNode.scrollLeft)
        this.y = -(offsetTop - (isAbsPos ? 0 : parentFlexNode.scrollTop))
      }
      if (offsetWidth !== _sizeVec2.x || offsetHeight !== _sizeVec2.y) {
        _sizeVec2 = this._sizeVec2 = Object.freeze(new Vector2(offsetWidth, offsetHeight))

        // Update pre-worldmatrix bounding sphere
        const sphere = this._geomBoundingSphere
        sphere.radius = Math.sqrt(offsetWidth * offsetWidth / 4 + offsetHeight * offsetHeight / 4)
        sphere.center.set(offsetWidth / 2, -offsetHeight / 2, 0)
        sphere.version++
      }
    }

    if (!isFullyClipped || !_wasFullyClipped) {
      // Update shared vector objects for the sublayers
      const radii = (hasBg || hasBorder) ? this._normalizeBorderRadius() : null

      tempVec4.fromArray(borderWidth)
      if (!tempVec4.equals(_borderWidthVec4)) {
        _borderWidthVec4 = this._borderWidthVec4 = Object.freeze(tempVec4.clone())
      }
      tempVec4.set(
        Math.max(this.clipLeft, 0),
        Math.max(this.clipTop, 0),
        Math.min(this.clipRight, offsetWidth),
        Math.min(this.clipBottom, offsetHeight)
      )
      if (!tempVec4.equals(_clipRectVec4)) {
        _clipRectVec4 = this._clipRectVec4 = Object.freeze(tempVec4.clone())
      }

      // Update rendering layers...
      let bgLayer = null
      if (hasBg) {
        bgLayer = this._bgLayerDef || (this._bgLayerDef = {
          key: 'bg',
          facade: UIBlockLayer3DFacade
        })
        bgLayer.size = _sizeVec2
        bgLayer.color = backgroundColor
        bgLayer.borderRadius = radii
        bgLayer.material = backgroundMaterial
        bgLayer.clipRect = _clipRectVec4
        bgLayer.depthOffset = -flexNodeDepth
        bgLayer.renderOrder = flexNodeDepth //TODO how can we make this play with the rest of the scene?
        bgLayer.castShadow = this.castShadow
        bgLayer.receiveShadow = this.receiveShadow
      }
      layers.children[0] = bgLayer

      let borderLayer = null
      if (hasBorder) {
        borderLayer = this._borderLayerDef || (this._borderLayerDef = {
          key: 'border',
          facade: UIBlockLayer3DFacade,
          isBorder: true
        })
        borderLayer.size = _sizeVec2
        borderLayer.color = borderColor
        borderLayer.borderWidth = _borderWidthVec4
        borderLayer.borderRadius = radii
        borderLayer.material = borderMaterial
        borderLayer.clipRect = _clipRectVec4
        borderLayer.depthOffset = -flexNodeDepth - 1
        borderLayer.renderOrder = flexNodeDepth + 1 //TODO how can we make this play with the rest of the scene?
        borderLayer.castShadow = this.castShadow
        borderLayer.receiveShadow = this.receiveShadow
      }
      layers.children[1] = borderLayer

      // Scrollbars if scrollable:
      let scrollbarsLayer = null
      if (canScroll) {
        scrollbarsLayer = this._scrollbarsDef || (this._scrollbarsDef = {
          key: 'sb',
          facade: ScrollbarsFacade,
          target: this
        })
        scrollbarsLayer.renderOrder = flexNodeDepth + 2 //TODO how can we make this play with the rest of the scene?
      }
      layers.children[2] = scrollbarsLayer

      // Allow text to be specified as a single string child
      if (!text && isTextNodeChild(this.children)) {
        text = '' + this.children
      }
      // Update text child...
      if (text) {
        const textChild = this._textChildDef || (this._textChildDef = {
          key: 'text',
          facade: UITextNode3DFacade
        })
        textChild.text = text
        textChild.font = getInheritable(this, 'font')
        textChild.fontSize = this.getComputedFontSize()
        textChild.textAlign = getInheritable(this, 'textAlign')
        textChild.textIndent = getInheritable(this, 'textIndent')
        textChild.lineHeight = getInheritable(this, 'lineHeight', DEFAULT_LINE_HEIGHT)
        textChild.letterSpacing = getInheritable(this, 'letterSpacing', 0)
        textChild.whiteSpace = getInheritable(this, 'whiteSpace')
        textChild.overflowWrap = getInheritable(this, 'overflowWrap')
        textChild.color = getInheritable(this, 'color')
        textChild.colorRanges = this.colorRanges
        textChild.outlineWidth = this.textOutlineWidth || 0
        textChild.outlineColor = this.textOutlineColor
        textChild.outlineOpacity = this.textOutlineOpacity
        textChild.outlineBlur = this.textOutlineBlur || 0
        textChild.outlineOffsetX = this.textOutlineOffsetX || 0
        textChild.outlineOffsetY = this.textOutlineOffsetY || 0
        textChild.strokeWidth = this.textStrokeWidth || 0
        textChild.strokeColor = this.textStrokeColor
        textChild.strokeOpacity = this.textStrokeOpacity
        textChild.fillOpacity = this.textFillOpacity
        textChild.material = this.textMaterial
        textChild.depthOffset = -flexNodeDepth - 1
        textChild.renderOrder = flexNodeDepth + 1
        textChild.castShadow = this.castShadow
        textChild.receiveShadow = this.receiveShadow
        this._actualChildren = textChild //NOTE: text content will clobber any other defined children
      } else {
        // Convert any children specified as plain strings to nested text blocks; handy for JSX style
        let children = this.children
        if (Array.isArray(children)) {
          for (let i = 0, len = children.length; i < len; i++) {
            if (isTextNodeChild(children[i])) {
              children = children.slice()
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
        this._actualChildren = children
      }
    }

    // Add mousewheel and drag listeners if scrollable
    if (canScroll !== this._couldScroll) {
      this._couldScroll = canScroll
      this[`${canScroll ? 'add' : 'remove'}EventListener`]('wheel', wheelHandler)
      this[`${canScroll ? 'add' : 'remove'}EventListener`]('dragstart', dragHandler)
      this[`${canScroll ? 'add' : 'remove'}EventListener`]('drag', dragHandler)
    }

    super.afterUpdate()
    if (!isFullyClipped || !_wasFullyClipped) {
      layers.afterUpdate()
    }
    this._wasFullyClipped = isFullyClipped
  }

  describeChildren () {
    return this._actualChildren
  }

  getComputedFontSize() {
    return getComputedFontSize(this, DEFAULT_FONT_SIZE)
  }

  _normalizeBorderRadius() {
    let {
      borderRadius:input,
      offsetWidth=0,
      offsetHeight=0,
      _borderRadiiVec4:prevVec4
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

    // Update the Vector4 if anything changed
    tempVec4.set(tl, tr, br, bl)
    if (!tempVec4.equals(prevVec4)) {
      prevVec4 = this._borderRadiiVec4 = Object.freeze(tempVec4.clone())
    }
    return prevVec4
  }

  /**
   * @override Use our private boundingSphere which we keep updated as we get new
   * layout metrics.
   */
  _getGeometryBoundingSphere() {
    return this._geomBoundingSphere.radius && !this.isFullyClipped ? this._geomBoundingSphere : null
  }

  /**
   * @override Custom raycaster to test against the layout block
   */
  raycast(raycaster) {
    const {offsetWidth, offsetHeight, clipTop, clipRight, clipBottom, clipLeft} = this
    let hits = null
    if (offsetWidth && offsetHeight) {
      raycastMesh.matrixWorld.multiplyMatrices(
        this.threeObject.matrixWorld,
        tempMat4.makeScale(offsetWidth, offsetHeight, 1)
      )
      hits = this._raycastObject(raycastMesh, raycaster)
      if (hits) {
        // Filter out hits that occurred on clipped areas
        hits = hits.filter(hit => {
          const x = hit.uv.x * offsetWidth
          const y = (1 - hit.uv.y) * offsetHeight
          return x > clipLeft && x < clipRight && y > clipTop && y < clipBottom
        })

        // Add a distance bias (used as secondary sort for equidistant intersections) to prevent
        // container blocks from intercepting pointer events for their children. Also apply a
        // slight rounding prevent floating point precision irregularities from reporting different
        // distances for coplanar blocks.
        hits.forEach(hit => {
          hit.distance = parseFloat(hit.distance.toFixed(12))
          hit.distanceBias = -this.flexNodeDepth
        })
      }
    }
    return hits && hits.length ? hits : null
  }


  destructor() {
    this.layers.destructor()
    super.destructor()
  }
}

// Extend as FlexNode
const UIBlock3DFacade$FlexNode = UIBlock3DFacade = extendAsFlexNode(UIBlock3DFacade)

INHERITABLES.forEach(prop => {
  UIBlock3DFacade.prototype[prop] = 'inherit'
})



function wheelHandler(e) {
  if (!e._didScroll) {
    const facade = e.currentTarget
    let {deltaX, deltaY, deltaMode} = e.nativeEvent
    let deltaMultiplier
    if (deltaMode === 0x01) { //line mode
      deltaMultiplier = getComputedFontSize(facade, DEFAULT_FONT_SIZE) *
        getInheritable(facade, 'lineHeight', 1.2) //Note: fixed default since we can't resolve 'normal' here
    } else { //pixel mode
      //TODO can we more accurately scale to visual expectation?
      deltaMultiplier = getComputedFontSize(facade, DEFAULT_FONT_SIZE) / 12
    }
    deltaX *= deltaMultiplier
    deltaY *= deltaMultiplier

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
      (scrollLeft !== facade.scrollLeft && abs(deltaX) > abs(deltaY)) ||
      (scrollTop !== facade.scrollTop && abs(deltaY) > abs(deltaX))
    ) {
      facade.scrollLeft = scrollLeft
      facade.scrollTop = scrollTop
      facade.afterUpdate()
      facade.requestRender()
      e._didScroll = true
    }
    e.preventDefault()
  }
}

function dragHandler(e) {
  if (!e._didScroll && !e.defaultPrevented) {
    const facade = e.currentTarget
    const ray = e.ray.clone().applyMatrix4(invertMatrix4(facade.threeObject.matrixWorld, tempMat4))
    const localPos = ray.intersectPlane(tempPlane.setComponents(0, 0, 1, 0), new Vector3())
    const prevPos = facade._prevDragPos
    if (localPos && prevPos && e.type === 'drag') {
      const deltaX = localPos.x - prevPos.x
      const deltaY = localPos.y - prevPos.y
      if (deltaX || deltaY) {
        const scrollLeft = Math.max(0, Math.min(
          facade.scrollWidth - facade.clientWidth,
          facade.scrollLeft + deltaX
        ))
        const scrollTop = Math.max(0, Math.min(
          facade.scrollHeight - facade.clientHeight,
          facade.scrollTop + deltaY
        ))
        if (scrollLeft !== facade.scrollLeft || scrollTop !== facade.scrollTop) {
          facade.scrollLeft = scrollLeft
          facade.scrollTop = scrollTop
          facade.afterUpdate()
          facade.requestRender()
          e._didScroll = true
        }
      }
    }
    facade._prevDragPos = localPos
  }
}


function isTextNodeChild(child) {
  return typeof child === 'string' || typeof child === 'number'
}

function updateMatrices(obj) {
  if (obj.updateMatrices) {
    obj.updateMatrices()
  }
}



export default UIBlock3DFacade
