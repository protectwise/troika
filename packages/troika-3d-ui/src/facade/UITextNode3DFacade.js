import { extendAsFlexNode } from '../flex-layout/FlexNode.js'
import { Text3DFacade } from 'troika-3d-text'
import { getInheritable, INHERITABLES } from '../uiUtils.js'

const flexLayoutTextProps = ['text', 'textIndent', 'font', 'fontSize', 'lineHeight', 'letterSpacing', 'whiteSpace', 'overflowWrap']
const noop = () => {}

/**
 * Wrapper for Text3DFacade that lets it act as a flex layout node. This shouldn't be used
 * directly, but will be created as an implicit child by {@link UIBlock3DFacade} when
 * configured with a `text` property.
 */
class UITextNode3DFacade extends Text3DFacade {
  constructor (props) {
    super(props)

    // Override the sync method so we can have control over when it's called
    let mesh = this.threeObject
    mesh._actuallySync = mesh.sync
    mesh.sync = noop
  }

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
      let parent = this.parentFlexNode
      this.x = offsetLeft - parent.scrollLeft
      this.y = -(offsetTop - parent.scrollTop)

      // Update clip rect based on parent
      const clipRect = this.clipRect || (this.clipRect = [0, 0, 0, 0])
      clipRect[0] = this.clipLeft
      clipRect[1] = -this.clipBottom
      clipRect[2] = this.clipRight
      clipRect[3] = -this.clipTop

      // If fully hidden by parent clipping rect, cull this object out of the scene
      this.threeObject.visible = !this.isFullyClipped
    }

    // Check text props that could affect flex layout
    // TODO seems odd that this happens here rather than FlexLayoutNode
    const flexStyles = this._flexStyles
    for (let i = 0, len = flexLayoutTextProps.length; i < len; i++) {
      const prop = flexLayoutTextProps[i]
      const val = prop === 'text' ? this.text : getInheritable(this, prop)
      if (val !== flexStyles[prop]) {
        flexStyles[prop] = this[prop]
        this.needsFlexLayout = true
      }
    }

    super.afterUpdate()
  }

  onAfterFlexLayoutApplied() {
    this.threeObject.maxWidth = this.offsetWidth
    this.threeObject._actuallySync(this._afterSync)
  }

  getBoundingSphere() {
    return null //parent UIBlock3DFacade will handle bounding sphere and raycasting
  }
}

// Extend as FlexNode
UITextNode3DFacade = extendAsFlexNode(UITextNode3DFacade)

INHERITABLES.forEach(prop => {
  UITextNode3DFacade.prototype[prop] = 'inherit'
})

// Redefine the maxWidth property so it's not treated as a setter that affects flexbox layout
Object.defineProperty(UITextNode3DFacade.prototype, 'maxWidth', {
  value: Infinity,
  enumerable: true,
  writable: true
})

export default UITextNode3DFacade
