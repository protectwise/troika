import computeLayout from 'css-layout'
import {assign, removeFromArray, createThenable} from '../../../utils'
import {setUpToFourValues} from './uiUtils'


const ZERO_SIZE = Object.freeze({width: 0, height: 0})


export function makeFlexLayoutNode(WrappedFacadeClass) {

  class FlexLayoutNode extends WrappedFacadeClass {
    constructor(parent) {
      super(parent)
      this.isFlexLayoutNode = true

      const flexNode = this._flexNode = {
        facade: this,
        parent: null,
        depth: 0,
        style: {
          get measure() {
            return flexNode.facade.measureIntrinsicSize ? boundMeasure : undefined
          }
        },
        children: [],
        layout: null
      }
      const boundMeasure = this._measureFlexNode.bind(this)

      // Look for the nearest flex layout ancestor; if there is one, add to its layout children,
      // otherwise we're a flex layout root.
      let parentFlexFacade = parent
      while (parentFlexFacade && !parentFlexFacade.isFlexLayoutNode) parentFlexFacade = parentFlexFacade.parent
      if (parentFlexFacade) {
        const parentFlexNode = parentFlexFacade._flexNode
        parentFlexNode.children.push(flexNode)
        flexNode.parent = parentFlexNode
        flexNode.depth = parentFlexNode.depth + 1
      }
    }

    afterUpdate() {
      super.afterUpdate()

      // Did something change that requires a layout recalc?
      if (this._flexNode.isDirty) {
        // If we're managed by an ancestor layout root, let it know
        if (this._flexNode.parent) {
          this.notifyWorld('needsFlexLayout')
        }
        // If we're the layout root, perform the layout
        else {
          this._performRootLayout()
        }
      }
    }

    onNotifyWorld(source, message, data) {
      if (!this._flexNode.parent) {
        if (message === 'needsFlexLayout') {
          this._flexNode.isDirty = true
          return
        } else if (message === 'flexMeasureAsync') {
          // const thenable = createThenable()
          // data.then(() => {
          //   this._flexNode.isDirty = true
          //   thenable.resolve()
          // })
          const batch = this._measureThenables || (
            this._measureThenables = new ThenableBatch(() => {
              // Mark entire tree dirty and rerun layout
              this._withEachFlexNode(node => {
                node.isDirty = true
              })
              this._performRootLayout()
            })
          )
          batch.add(data)
          return
        }
      }
      super.onNotifyWorld(source, message, data)
    }

    _performRootLayout() {
      this._measureThenables = null

      // TEMP!!!
      this._withEachFlexNode(node => {
        node.isDirty = true
      })


      //console.time('Flex Layout')
      computeLayout(this._flexNode)
      //console.timeEnd('Flex Layout')

      // Clear dirty state even if results weren't yet applied
      this._withEachFlexNode(node => {
        node.isDirty = false
      })

      // Apply the results to each FlexLayoutNode facade in the tree, unless there were any
      // promiselike async measurements in which case this will be rerun when they are all resolved
      if (!this._measureThenables) {
        this._applyLayoutResults()
      }
    }

    _measureFlexNode(maxWidth) {
      if (isNaN(maxWidth)) maxWidth = Infinity
      const dims = this.measureIntrinsicSize(maxWidth)
      if (typeof dims === 'object' && typeof dims.then === 'function') {
        this.onNotifyWorld(this, 'flexMeasureAsync', dims)
      } else {
        return dims
      }
      return ZERO_SIZE
    }

    /**
     * Get the depth of this node in the flexbox tree, where the root is 0
     */
    get flexNodeDepth() {
      return this._flexNode.depth
    }

    _applyLayoutResults() {
      // Set computed layout properties
      this._withEachFlexNode(node => {
        const {facade, layout} = node
        facade.computedLeft = layout.left
        facade.computedTop = layout.top
        facade.computedWidth = layout.width
        facade.computedHeight = layout.height
      })

      // Run afterUpdate once for the whole tree
      this.afterUpdate()
    }

    _withEachFlexNode(fn) {
      function visit(node) {
        fn(node)
        node.children.forEach(visit)
      }
      visit(this._flexNode)
    }

    destructor() {
      const parentFlexNode = this._flexNode.parent
      if (parentFlexNode) {
        removeFromArray(parentFlexNode.children, this)
      }
      super.destructor()
    }
  }


  // Setters for simple flex layout properties that can be copied directly into the
  // flex node's style input object
  ;[
    'width',
    'height',
    'minWidth',
    'minHeight',
    'maxWidth',
    'maxHeight',
    'left',
    'right',
    'top',
    'bottom',
    'flexDirection',
    'justifyContent',
    'alignItems',
    'alignSelf',
    'flex',
    'flexWrap',
    'position'
  ].forEach(prop => {
    Object.defineProperty(FlexLayoutNode.prototype, prop, {
      get() {
        return this._flexNode.style[prop]
      },
      set(value) {
        const node = this._flexNode
        if (value !== node.style[prop]) {
          node.isDirty = true
          node.style[prop] = value
        }
      }
    })
  })

  // Add setters to normalize top/right/bottom/left properties which can be a single
  // number or an array of up to 4 numbers, like their corresponding CSS shorthands
  ;[
    ['margin', 'margin', ''],
    ['padding', 'padding', ''],
    ['borderWidth', 'border', 'Width']
  ].forEach(([shorthandProp, longhandPrefix, longhandSuffix]) => {
    const privateProp = `_priv_${shorthandProp}`
    Object.defineProperty(FlexLayoutNode.prototype, shorthandProp, {
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
        const arr = this[shorthandProp]
        if (t !== arr[0] || r !== arr[1] || b !== arr[2] || l !== arr[3]) {
          this[privateProp] = Object.freeze([t, r, b, l])

          // Expand into longhand props on the flex node's style input
          // TODO look into making these getters on the style obj itself
          const style = this._flexNode.style
          style[`${longhandPrefix}Top${longhandSuffix}`] = t
          style[`${longhandPrefix}Right${longhandSuffix}`] = r
          style[`${longhandPrefix}Bottom${longhandSuffix}`] = b
          style[`${longhandPrefix}Left${longhandSuffix}`] = l
          this._flexNode.isDirty = true
        }
      }
    })
  })

  /**
   * @abstract If implemented, will provide content size measurements during flex layout.
   * The result should be an object with numeric width and height properties. If the measurement
   * cannot be immediately determined, it may return a "thenable"/Promise that will resolve when
   * the answer is ready; the resolution value will not be used, but it will trigger a full re-layout
   * during which the answer is now expected to return immediately, so the implementation should cache it.
   *
   * @param {Number} maxWidth - the max width for the current size calculation. May be Infinity.
   * @return {Readonly<{width: number, height: number}>|{then}}
   */
  FlexLayoutNode.prototype.measureIntrinsicSize = null

  return FlexLayoutNode
}


function isNum(v) {return typeof v === 'number'}


function ThenableBatch(onAllResolved) {
  let count = 0
  function onResolve() {
    if (--count === 0) {
      onAllResolved()
    }
  }
  this.add = function(thenable) {
    count++
    thenable.then(onResolve)
  }
}


