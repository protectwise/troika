import {requestFlexLayout} from './FlexLayoutProcessor'
import {assign} from '../../../utils'



export function makeFlexLayoutNode(WrappedFacadeClass) {

  class FlexLayoutNode extends WrappedFacadeClass {
    constructor(parent) {
      super(parent)
      this.isFlexLayoutNode = true
      this._needsFlexLayout = true

      // Object holding all input styles for this node in the flex tree; see the style object
      // format in FlexLayoutProcessor.js
      this._flexStyles = {
        id: this.$facadeId
      }

      // Look for the nearest flex layout ancestor; if there is one, add to its layout children,
      // otherwise we're a flex layout root.
      let parentFlexFacade = parent
      while (parentFlexFacade && !parentFlexFacade.isFlexLayoutNode) {parentFlexFacade = parentFlexFacade.parent}
      if (parentFlexFacade) {
        this._flexParent = parentFlexFacade
        this._flexNodeDepth = parentFlexFacade.flexNodeDepth + 1
      } else {
        this._flexNodeDepth = 0
      }
    }

    afterUpdate() {
      super.afterUpdate()

      // Did something change that requires a layout recalc?
      if (this._needsFlexLayout) {
        // If we're managed by an ancestor layout root, let it know
        if (this._flexParent) {
          this.notifyWorld('needsFlexLayout')
          this._needsFlexLayout = false
        }
        // If we're the layout root, perform the layout
        else {
          this._performRootLayout()
        }
      }
    }

    onNotifyWorld(source, message, data) {
      if (message === 'needsFlexLayout' && !this._flexParent) {
        this._needsFlexLayout = true
        return
      }
      super.onNotifyWorld(source, message, data)
    }

    _performRootLayout() {
      // If there's a request in progress, don't queue another one yet; that will happen
      // automatically after the current one finishes and it calls afterUpdate again
      if (this._hasActiveFlexRequest) return

      this._hasActiveFlexRequest = true
      this._needsFlexLayout = false

      // Traverse the flex node tree in document order and add the ordered child
      // relationships to the style nodes at each level
      this.traverseOrdered(facade => {
        if (facade.isFlexLayoutNode) {
          const parent = facade._flexParent
          if (parent) {
            const siblings = parent._flexStyles.children || (parent._flexStyles.children = [])
            siblings.push(facade._flexStyles)
          }
          facade._flexStyles.children = null //clear own leftover children from last time
        }
      })

      requestFlexLayout(this._flexStyles, results => {
        this._applyRootLayoutResults(results)

        // Final afterUpdate on the whole subtree
        this._hasActiveFlexRequest = false
        this.afterUpdate()
        this.notifyWorld('needsRender')
      })
    }

    _applyRootLayoutResults(results) {
      // Results will be a flat map of facade id to computed layout; traverse the tree
      // and math them up, applying them as `computedXYZ` properties
      this.traverse(facade => {
        if (facade.isFlexLayoutNode) {
          const computedLayout = results[facade.$facadeId]
          if (computedLayout) {
            const {left, top, width, height} = computedLayout
            const {borderWidth, padding} = facade

            // Outer metrics
            facade.offsetLeft = left
            facade.offsetTop = top
            facade.offsetWidth = width
            facade.offsetHeight = height

            // Inner metrics
            facade.clientLeft = borderWidth[3] + padding[3]
            facade.clientTop = borderWidth[0] + padding[0]
            facade.clientWidth = width - borderWidth[1] - borderWidth[3] - padding[1] - padding[3]
            facade.clientHeight = height - borderWidth[0] - borderWidth[2] - padding[0] - padding[2]

            // Scrolling metrics
            facade.scrollHeight = facade.scrollWidth = 0
            const parent = facade._flexParent
            if (parent) {
              parent.scrollWidth = Math.max(parent.scrollWidth, left + width - parent.clientLeft)
              parent.scrollHeight = Math.max(parent.scrollHeight, top + height - parent.clientTop)
            }
          }
        }
      })
    }

    /**
     * Get the depth of this node in the flexbox tree, where the root is 0
     */
    get flexNodeDepth() {
      return this._flexNodeDepth
    }
  }

  // Define computed layout properties. Those that depend on a layout computation will be null
  // initially, and set to numbers after layout calculation is completed. Derived facades should
  // use these to update their rendering.
  assign(FlexLayoutNode.prototype, {
    offsetLeft: null,
    offsetTop: null,
    offsetWidth: null,
    offsetHeight: null,
    clientLeft: null,
    clientTop: null,
    clientWidth: null,
    clientHeight: null,
    scrollLeft: 0,
    scrollTop: 0,
    scrollWidth: null,
    scrollHeight: null
  })

  // Setters for simple flex layout properties that can be copied directly into the
  // flex node's style input object
  ;[
    'width',
    'height',
    'minWidth',
    'minHeight',
    'maxWidth',
    'maxHeight',
    'aspectRatio',
    'flexDirection',
    'flex',
    'flexWrap',
    'flexBasis',
    'flexGrow',
    'flexShrink',
    'alignContent',
    'alignItems',
    'alignSelf',
    'justifyContent',
    'position',
    'left',
    'right',
    'top',
    'bottom'
  ].forEach(prop => {
    Object.defineProperty(FlexLayoutNode.prototype, prop, {
      get() {
        return this._flexStyles[prop]
      },
      set(value) {
        if (value !== this._flexStyles[prop]) {
          this._flexStyles[prop] = value
          this._needsFlexLayout = true
        }
      }
    })
  })

  // Add setters to normalize top/right/bottom/left properties which can be a single
  // number or an array of up to 4 numbers, like their corresponding CSS shorthands
  ;[
    'margin',
    'padding',
    'borderWidth'
  ].forEach(prop => {
    const privateProp = `_priv_${prop}`
    const styleBase = prop === 'borderWidth' ? 'border' : prop
    const topStyle = styleBase + 'Top'
    const rightStyle = styleBase + 'Right'
    const bottomStyle = styleBase + 'Bottom'
    const leftStyle = styleBase + 'Left'
    Object.defineProperty(FlexLayoutNode.prototype, prop, {
      get() {
        return this[privateProp] || (this[privateProp] = Object.freeze([0, 0, 0, 0]))
      },
      set(value) {
        let t, r, b, l
        if (Array.isArray(value)) {
          const len = value.length
          t = value[0] || 0
          r = (len > 1 ? value[1] : value[0]) || 0
          b = (len > 2 ? value[2] : value[0]) || 0
          l = (len > 3 ? value[3] : len > 1 ? value[1] : value[0]) || 0
        } else {
          t = r = b = l = value
        }
        const arr = this[prop]
        if (t !== arr[0] || r !== arr[1] || b !== arr[2] || l !== arr[3]) {
          this[privateProp] = Object.freeze([t, r, b, l])
          const styles = this._flexStyles
          styles[topStyle] = t
          styles[rightStyle] = r
          styles[bottomStyle] = b
          styles[leftStyle] = l
          this._needsFlexLayout = true
        }
      }
    })
  })

  return FlexLayoutNode
}

