import {requestFlexLayout} from './FlexLayoutProcessor'
import {assign, createClassExtender} from '../../../utils'

/**
 * Extends a given Facade class to become a `FlexNode`, giving it the ability to participate
 * in flexbox layout. The resulting class behaves just like the original facade class, except:
 *
 * - It now accepts a full set of flexbox-related input properties, defined below
 * - Those input properties get evaluated by a flexbox layout algorithm in the background
 * - The resulting layout metrics get written to the object as properties that the extended
 *   facade class can use in its `afterUpdate` method to affect its position/size/styling.
 *
 * The flexbox layout algorithm is performed asynchronously within a web worker, so the result
 * metrics will probably not be available the first time `afterUpdate` is called. This can
 * sometimes cause issues with rendering due to NaNs, so it's good to check first that the
 * object has a nonzero `offsetWidth` and `offsetHeight` before displaying the node's object(s).
 *
 * Currently the flexbox algorithm implementation is Facebook's Yoga (https://yogalayout.com/)
 * which is loaded on first use from the JSDelivr CDN. Customization of the Yoga files' location
 * will be added at a later time.
 *
 * *Supported input flexbox style properties:*
 * - width (number, string percentage, or 'auto')
 * - height (number, string percentage, or 'auto')
 * - minWidth (number, string percentage, or 'auto')
 * - minHeight (number, string percentage, or 'auto')
 * - maxWidth (number, string percentage, or 'auto')
 * - maxHeight (number, string percentage, or 'auto')
 * - aspectRatio (number, as width divided by height, or 'auto')
 * - flexDirection ('column', 'column-reverse', 'row', or 'row-reverse')
 * - flexWrap ('wrap' or 'nowrap')
 * - flex (number, where positive becomes flexGrow and negative becomes flexShrink)
 * - flexGrow (number)
 * - flexShrink (number)
 * - flexBasis (number, string percentage, or 'auto')
 * - alignContent ('auto', 'baseline', 'center', 'flex-end', 'flex-start', or 'stretch')
 * - alignItems ('auto', 'baseline', 'center', 'flex-end', 'flex-start', or 'stretch')
 * - alignSelf ('auto', 'baseline', 'center', 'flex-end', 'flex-start', or 'stretch')
 * - justifyContent ('center', 'flex-end', 'flex-start', 'space-around', or 'space-between')
 * - position ('relative' or 'absolute')
 * - top (number, string percentage, or 'auto')
 * - right (number, string percentage, or 'auto')
 * - bottom (number, string percentage, or 'auto')
 * - left (number, string percentage, or 'auto')
 * - margin (number, or array of up to four numbers in t-r-b-l order)
 * - padding (number, or array of up to four numbers in t-r-b-l order)
 * - borderWidth (number, or array of up to four numbers in t-r-b-l order)
 *
 * *Computed layout result properties:*
 * - offsetLeft
 * - offsetTop
 * - offsetWidth
 * - offsetHeight
 * - clientLeft
 * - clientTop
 * - clientWidth
 * - clientHeight
 * - scrollLeft
 * - scrollTop
 * - scrollWidth
 * - scrollHeight
 * - clipLeft
 * - clipTop
 * - clipRight
 * - clipBottom
 * (All of these are `null` initially and then numbers after the layout completes, except
 * scrollLeft and scrollTop which are `0` initially.)
 *
 * *Additional FlexNode-specific properties:*
 * - isFlexNode (`true`, can be used to find FlexNodes in the facade tree)
 * - flexNodeDepth (number, where topmost FlexNode's depth is `0` and children increase by 1)
 * - parentFlexNode (the nearest parent FlexNode instance, or `null` if this is the root FlexNode)
 * - needsFlexLayout (boolean, can be set to force a recalculation of the full flexbox layout)
 *
 * @param {class} BaseFacadeClass
 * @return {FlexNode} a new class that extends the BaseFacadeClass
 */
export const extendAsFlexNode = createClassExtender('flexNode', BaseFacadeClass => {

  class FlexNode extends BaseFacadeClass {
    constructor(parent) {
      super(parent)
      this.isFlexNode = true
      this.needsFlexLayout = true

      // Object holding all input styles for this node in the flex tree; see the style object
      // format in FlexLayoutProcessor.js
      this._flexStyles = {
        id: this.$facadeId
      }

      // Look for the nearest flex layout ancestor; if there is one, add to its layout children,
      // otherwise we're a flex layout root.
      let parentFlexFacade = parent
      while (parentFlexFacade && !parentFlexFacade.isFlexNode) {parentFlexFacade = parentFlexFacade.parent}
      if (parentFlexFacade) {
        this.parentFlexNode = parentFlexFacade
        this.flexNodeDepth = parentFlexFacade.flexNodeDepth + 1
      } else {
        this.flexNodeDepth = 0
      }
    }

    afterUpdate() {
      // Keep max scroll and clip rects in sync
      if (this.offsetWidth != null) {
        this._checkOverscroll()
        this._updateClipRect()
      }

      super.afterUpdate()

      // Did something change that requires a layout recalc?
      if (this.needsFlexLayout) {
        // If we're managed by an ancestor layout root, let it know
        if (this.parentFlexNode) {
          this.notifyWorld('needsFlexLayout')
          this.needsFlexLayout = false
        }
        // If we're the layout root, perform the layout
        else {
          this._performRootLayout()
        }
      }
    }

    onNotifyWorld(source, message, data) {
      if (message === 'needsFlexLayout' && !this.parentFlexNode) {
        this.needsFlexLayout = true
        return
      }
      super.onNotifyWorld(source, message, data)
    }

    _performRootLayout() {
      // If there's a request in progress, don't queue another one yet; that will happen
      // automatically after the current one finishes and it calls afterUpdate again
      if (this._hasActiveFlexRequest) return

      this._hasActiveFlexRequest = true
      this.needsFlexLayout = false

      // Traverse the flex node tree in document order and add the ordered child
      // relationships to the style nodes at each level
      this.traverse(facade => {
        if (facade.isFlexNode) {
          const parent = facade.parentFlexNode
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
        if (facade.isFlexNode) {
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
            const parent = facade.parentFlexNode
            if (parent) {
              parent.scrollWidth = Math.max(parent.scrollWidth, left + width - parent.clientLeft)
              parent.scrollHeight = Math.max(parent.scrollHeight, top + height - parent.clientTop)
            }
          }
        }
      })
    }

    _checkOverscroll() {
      const {scrollLeft, scrollTop} = this
      if (scrollLeft || scrollTop) {
        const maxScrollLeft = Math.max(0, this.scrollWidth - this.clientWidth)
        const maxScrollTop = Math.max(0, this.scrollHeight - this.clientHeight)
        if (maxScrollLeft < scrollLeft) {
          this.scrollLeft = maxScrollLeft
        }
        if (maxScrollTop < scrollTop) {
          this.scrollTop = maxScrollTop
        }
      }
    }

    _updateClipRect() {
      let child = this
      let parent = child.parentFlexNode
      let totalOffsetLeft = 0
      let totalOffsetTop = 0
      const negInf = -Infinity
      let maxInsetLeft = negInf
      let maxInsetTop = negInf
      let maxInsetRight = negInf
      let maxInsetBottom = negInf

      while (parent) {
        totalOffsetLeft += child.offsetLeft - parent.scrollLeft
        totalOffsetTop += child.offsetTop - parent.scrollTop

        const insetLeft = parent.clientLeft - totalOffsetLeft
        const insetTop = parent.clientTop - totalOffsetTop
        const insetRight = (totalOffsetLeft + this.offsetWidth) - (parent.clientLeft + parent.clientWidth)
        const insetBottom = (totalOffsetTop + this.offsetHeight) - (parent.clientTop + parent.clientHeight)
        if (insetLeft > maxInsetLeft) maxInsetLeft = insetLeft
        if (insetTop > maxInsetTop) maxInsetTop = insetTop
        if (insetRight > maxInsetRight) maxInsetRight = insetRight
        if (insetBottom > maxInsetBottom) maxInsetBottom = insetBottom

        child = parent
        parent = parent.parentFlexNode
      }

      this.clipLeft = maxInsetLeft
      this.clipTop = maxInsetTop
      this.clipRight = this.offsetWidth - maxInsetRight
      this.clipBottom = this.offsetHeight - maxInsetBottom
    }
  }

  // Define computed layout properties. Those that depend on a layout computation will be null
  // initially, and set to numbers after layout calculation is completed. Derived facades should
  // use these to update their rendering.
  assign(FlexNode.prototype, {
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
    scrollHeight: null,
    clipLeft: null,
    clipTop: null,
    clipRight: null,
    clipBottom: null
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
    Object.defineProperty(FlexNode.prototype, prop, {
      get() {
        return this._flexStyles[prop]
      },
      set(value) {
        if (value !== this._flexStyles[prop]) {
          this._flexStyles[prop] = value
          this.needsFlexLayout = true
        }
      },
      configurable: true
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
    Object.defineProperty(FlexNode.prototype, prop, {
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
          this.needsFlexLayout = true
        }
      }
    })
  })

  return FlexNode
})

