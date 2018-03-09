import computeLayout from 'css-layout'
import {assign, removeFromArray, BasicThenable} from '../../../utils'
import {setUpToFourValues} from './uiUtils'
import Yoga from "yoga-layout"


const ZERO_SIZE = Object.freeze({width: 0, height: 0})


export function makeFlexLayoutNode(WrappedFacadeClass) {

  class FlexLayoutNode extends WrappedFacadeClass {
    constructor(parent) {
      super(parent)
      this.isFlexLayoutNode = true

      const yogaConfig = this._yogaConfig = Yoga.Config.create()
      yogaConfig.setPointScaleFactor(0)
      const yogaNode = this._flexNode = Yoga.Node.createWithConfig(yogaConfig)
      yogaNode.facade = this
      yogaNode.parent = null
      yogaNode.depth = 0
      if (this.measureIntrinsicSize) {
        yogaNode.setMeasureFunc((innerWidth, widthMeasureMode, innerHeight, heightMeasureMode) => {
          return this._measureFlexNode(innerWidth)
        })
      }
      // {
      //   facade: this,
      //   parent: null,
      //   yogaNode: Yoga.Node.create(),
      //   depth: 0,
      //   style: {
      //     get measure() {
      //       return flexNode.facade.measureIntrinsicSize ? boundMeasure : undefined
      //     }
      //   },
      //   children: [],
      //   layout: null
      // }
      // const boundMeasure = this._measureFlexNode.bind(this)

      // Look for the nearest flex layout ancestor; if there is one, add to its layout children,
      // otherwise we're a flex layout root.
      let parentFlexFacade = parent
      while (parentFlexFacade && !parentFlexFacade.isFlexLayoutNode) parentFlexFacade = parentFlexFacade.parent
      if (parentFlexFacade) {
        const parentYogaNode = parentFlexFacade._flexNode
        parentYogaNode.insertChild(yogaNode, parentYogaNode.getChildCount())
        yogaNode.parent = parentYogaNode
        yogaNode.depth = parentYogaNode.depth + 1
      }
    }

    afterUpdate() {
      super.afterUpdate()

      // Did something change that requires a layout recalc?
      if (this._needsFlexLayout) {
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
          this._needsFlexLayout = true
          return
        } else if (message === 'flexMeasureAsync') {
          const thenable = BasicThenable()
          data.then(() => {
            source._flexNode.markDirty()
            thenable.resolve()
          })
          const batch = this._measureThenables || (
            this._measureThenables = new ThenableBatch(() => {
              this._performRootLayout()
            })
          )
          batch.add(thenable)
          return
        }
      }
      super.onNotifyWorld(source, message, data)
    }

    _performRootLayout() {
      this._measureThenables = null

      // TEMP!!!
      // this._withEachFlexNode(node => {
      //   node.isDirty = true
      // })


      //console.time('Flex Layout')
      // computeLayout(this._flexNode)
      this._flexNode.calculateLayout()
      //console.timeEnd('Flex Layout')

      // Clear dirty state even if results weren't yet applied
      // this._withEachFlexNode(node => {
      //   node.isDirty = false
      // })
      this._withEachFlexNode(facade => {
        facade._needsFlexLayout = false
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
      this._withEachFlexNode(facade => {
        const yogaNode = facade._flexNode
        facade.computedLeft = yogaNode.getComputedLeft()
        facade.computedTop = yogaNode.getComputedTop()
        facade.computedWidth = yogaNode.getComputedWidth()
        facade.computedHeight = yogaNode.getComputedHeight()
      })

      // Run afterUpdate once for the whole tree
      this.afterUpdate()
    }

    _withEachFlexNode(fn) {
      // function visit(yogaNode) {
      //   fn(yogaNode)
      //   for (let i = 0, len = yogaNode.getChildCount(); i < len; i++) {
      //     visit(yogaNode.getChild(i))
      //   }
      // }
      // visit(this._flexNode)
      // TODO the above fails because getChild returns objects that don't have our custom properties
      this.traverse(facade => {
        if (facade.isFlexLayoutNode) {
          fn(facade)
        }
      })
    }

    destructor() {
      const yogaNode = this._flexNode
      if (yogaNode.parent) {
        yogaNode.parent.removeChild(yogaNode)
      }
      yogaNode.free()
      this._yogaConfig.free()
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
    ['flexDirection', YOGA_VALUE_MAPPINGS.direction],
    'flex',
    ['flexWrap', YOGA_VALUE_MAPPINGS.wrap],
    'flexBasis',
    'flexGrow',
    'flexShrink',
    ['alignContent', YOGA_VALUE_MAPPINGS.align],
    ['alignItems', YOGA_VALUE_MAPPINGS.align],
    ['alignSelf', YOGA_VALUE_MAPPINGS.align],
    ['justifyContent', YOGA_VALUE_MAPPINGS.justify],
    ['position', YOGA_VALUE_MAPPINGS.position],
    'left',
    'right',
    'top',
    'bottom',
  ].forEach(prop => {
    let valueMapping = null
    if (Array.isArray(prop)) {
      valueMapping = prop[1]
      prop = prop[0]
    }
    const privateProp = '_priv_' + prop
    const yogaSetter = 'set' + prop.charAt(0).toUpperCase() + prop.substr(1)
    Object.defineProperty(FlexLayoutNode.prototype, prop, {
      get() {
        return this[privateProp]
      },
      set(value) {
        if (value !== this[privateProp]) {
          this[privateProp] = value
          if (valueMapping) {
            if (valueMapping.hasOwnProperty(value)) {
              value = valueMapping[value]
            } else {
              console.warn(`Unknown ${prop} value ${value}`)
            }
          }
          this._flexNode[yogaSetter](value)
          this._needsFlexLayout = true
        }
      }
    })
  })

  // Add setters to normalize top/right/bottom/left properties which can be a single
  // number or an array of up to 4 numbers, like their corresponding CSS shorthands
  ;[
    ['margin', 'setMargin'],
    ['padding', 'setPadding'],
    ['borderWidth', 'setBorder']
  ].forEach(([shorthandProp, yogaSetter]) => {
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
          const yogaNode = this._flexNode
          yogaNode[yogaSetter](Yoga.EDGE_TOP, t)
          yogaNode[yogaSetter](Yoga.EDGE_RIGHT, r)
          yogaNode[yogaSetter](Yoga.EDGE_BOTTOM, b)
          yogaNode[yogaSetter](Yoga.EDGE_LEFT, l)
          this._needsFlexLayout = true
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


const YOGA_VALUE_MAPPINGS = {
  align: {
    'auto': Yoga.ALIGN_AUTO,
    'baseline': Yoga.ALIGN_BASELINE,
    'center': Yoga.ALIGN_CENTER,
    'flex-end': Yoga.ALIGN_FLEX_END,
    'flex-start': Yoga.ALIGN_FLEX_START,
    'stretch': Yoga.ALIGN_STRETCH
  },
  direction: {
    'column': Yoga.FLEX_DIRECTION_COLUMN,
    'column-reverse': Yoga.FLEX_DIRECTION_COLUMN_REVERSE,
    'row': Yoga.FLEX_DIRECTION_ROW,
    'row-reverse': Yoga.FLEX_DIRECTION_ROW_REVERSE
  },
  justify: {
    'center': Yoga.JUSTIFY_CENTER,
    'flex-end': Yoga.JUSTIFY_FLEX_END,
    'flex-start': Yoga.JUSTIFY_FLEX_START,
    'space-around': Yoga.JUSTIFY_SPACE_AROUND,
    'space-between': Yoga.JUSTIFY_SPACE_BETWEEN
  },
  position: {
    'absolute': Yoga.POSITION_TYPE_ABSOLUTE,
    'relative': Yoga.POSITION_TYPE_RELATIVE
  },
  wrap: {
    nowrap: Yoga.WRAP_NO_WRAP,
    wrap: Yoga.WRAP_WRAP,
  }
}

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


