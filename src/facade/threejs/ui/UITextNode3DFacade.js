import { makeFlexLayoutNode } from './FlexLayoutNode'
import Text3DFacade from '../text/Text3DFacade'
import { getInheritable } from './uiUtils'

const flexLayoutTextProps = ['text', 'font', 'fontSize', 'lineHeight', 'letterSpacing', 'whiteSpace', 'overflowWrap']


/**
 * Wrapper for Text3DFacade that lets it act as a flex layout node. This shouldn't be used
 * directly, but will be created as an implicit child by {@link UIBlock3DFacade} when
 * configured with a `text` property.
 */
class UITextNode3DFacade extends makeFlexLayoutNode(Text3DFacade) {
  afterUpdate() {
    // Read computed layout
    const {
      offsetLeft,
      offsetTop,
      offsetWidth
    } = this

    // Update position and size if flex layout has been completed
    const hasLayout = offsetWidth !== null
    if (hasLayout) {
      let {clientLeft, clientTop, clientWidth, clientHeight, scrollLeft, scrollTop} = this._flexParent
      //scrollLeft = scrollTop = 0
      this.x = offsetLeft - scrollLeft
      this.y = -(offsetTop - scrollTop)
      this.maxWidth = offsetWidth

      // Update clip rect based on parent
      const clipRect = this.clipRect || (this.clipRect = [0, 0, 0, 0])
      clipRect[0] = clientLeft - offsetLeft + scrollLeft
      clipRect[1] = -(clientTop - offsetTop + scrollTop)
      clipRect[2] = clipRect[0] + clientWidth
      clipRect[3] = clipRect[1] - clientHeight
    }

    // Check text props that could affect flex layout
    // TODO seems odd that this happens here rather than FlexLayoutNode
    const flexStyles = this._flexStyles
    for (let i = 0, len = flexLayoutTextProps.length; i < len; i++) {
      const prop = flexLayoutTextProps[i]
      const val = getInheritable(this, prop)
      if (val !== flexStyles[prop]) {
        flexStyles[prop] = this[prop]
        this._needsFlexLayout = true
      }
    }

    this.threeObject.visible = hasLayout

    super.afterUpdate()
  }

  getBoundingSphere() {
    return null //parent UIBlock3DFacade will handle bounding sphere and raycasting
  }
}

// Redefine the maxWidth property so it's not treated as a setter that affects flexbox layout
Object.defineProperty(UITextNode3DFacade.prototype, 'maxWidth', {
  value: Infinity,
  enumerable: true,
  writable: true
})

export default UITextNode3DFacade
