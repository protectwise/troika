import { defineWorkerModule } from 'troika-worker-utils'
import { typesetterWorkerModule } from 'troika-three-text'
import yogaFactory from '../libs/yoga.factory.js'


/**
 * Main entry point. This issues a request to the web worker to perform flexbox layout
 * on the given `styleTree`, calling the `callback` function with the results when finished.
 *
 * @param {FlexLayoutStyleNode} styleTree
 * @param {function(FlexLayoutResult)} callback
 */
export function requestFlexLayout(styleTree, callback) {
  flexLayoutProcessorWorkerModule(styleTree).then(callback)
}

/**
 * @typedef {object<FlexLayoutResultNode>} FlexLayoutResult
 * Mapping of node ids to layout results.
 */

/**
 * @typedef {object} FlexLayoutResultNode - layout result for a single flex node.
 * @property {number} left - the node's computed left position
 * @property {number} top - the node's computed top position
 * @property {number} width - the node's computed width
 * @property {number} height - the node's computed height
 */


/**
 * @typedef {object} MeasureFunctionParams - Parameters for the `measureFunction`.
 * @property {string} text
 * @property {string} font
 * @property {number} fontSize
 * @property {number} lineHeight
 * @property {number} letterSpacing
 * @property {string} whiteSpace
 * @property {string} overflowWrap
 * @property {number} maxWidth
 */

/**
 * Factory for the flex layout processing function. This is injected into a web worker so it
 * must be entirely self-contained other than specific dependencies passed in as arguments.
 * @param {object} Yoga - The yoga-layout implementation object.
 * @param {function(fontUrl:string, callback:function)} loadFontFn - A function that
 *        loads a given font URL, invoking a callback when complete.
 * @param {function(MeasureFunctionParams):{width:number}} measureFunction - A function that
 *        measures the intrinsic dimensions for a block of text with given styles and
 *        constraints. The measurement must occur synchronously.
 * @return {function(FlexLayoutStyleNode):FlexLayoutResult}
 */
function createFlexLayoutProcessor(Yoga, loadFontFn, measureFunction) {

  const YOGA_VALUE_MAPPINGS = {
    align: {
      'auto': 'ALIGN_AUTO',
      'baseline': 'ALIGN_BASELINE',
      'center': 'ALIGN_CENTER',
      'flex-end': 'ALIGN_FLEX_END',
      'flex-start': 'ALIGN_FLEX_START',
      'stretch': 'ALIGN_STRETCH'
    },
    direction: {
      'column': 'FLEX_DIRECTION_COLUMN',
      'column-reverse': 'FLEX_DIRECTION_COLUMN_REVERSE',
      'row': 'FLEX_DIRECTION_ROW',
      'row-reverse': 'FLEX_DIRECTION_ROW_REVERSE'
    },
    edge: {
      top: 'EDGE_TOP',
      right: 'EDGE_RIGHT',
      bottom: 'EDGE_BOTTOM',
      left: 'EDGE_LEFT',
    },
    justify: {
      'center': 'JUSTIFY_CENTER',
      'flex-end': 'JUSTIFY_FLEX_END',
      'flex-start': 'JUSTIFY_FLEX_START',
      'space-around': 'JUSTIFY_SPACE_AROUND',
      'space-between': 'JUSTIFY_SPACE_BETWEEN'
    },
    position: {
      'absolute': 'POSITION_TYPE_ABSOLUTE',
      'relative': 'POSITION_TYPE_RELATIVE'
    },
    wrap: {
      'nowrap': 'WRAP_NO_WRAP',
      'wrap': 'WRAP_WRAP'
    }
  }

  const sides = ['Top', 'Right', 'Bottom', 'Left']

  // Create functions for setting each supported style property on a Yoga node
  const YOGA_SETTERS = Object.create(null)
  // Simple properties
  ;[
    'width',
    'height',
    'minWidth',
    'minHeight',
    'maxWidth',
    'maxHeight',
    'aspectRatio',
    ['flexDirection', YOGA_VALUE_MAPPINGS.direction],
    'flex',
    ['flexWrap', YOGA_VALUE_MAPPINGS.wrap],
    'flexBasis',
    'flexGrow',
    'flexShrink',
    ['alignContent', YOGA_VALUE_MAPPINGS.align],
    ['alignItems', YOGA_VALUE_MAPPINGS.align],
    ['alignSelf', YOGA_VALUE_MAPPINGS.align],
    ['justifyContent', YOGA_VALUE_MAPPINGS.justify]
  ].forEach(styleProp => {
    let mapping = null
    if (Array.isArray(styleProp)) {
      mapping = styleProp[1]
      styleProp = styleProp[0]
    }
    const setter = `set${styleProp.charAt(0).toUpperCase()}${styleProp.substr(1)}`
    YOGA_SETTERS[styleProp] = mapping ?
      (yogaNode, value) => {
        if (mapping.hasOwnProperty(value)) {
          value = Yoga[mapping[value]]
          yogaNode[setter](value)
        }
      } :
      (yogaNode, value) => {
        yogaNode[setter](value)
      }
  })

  // Position-related properties
  YOGA_SETTERS.position = (yogaNode, value) => {
    yogaNode.setPositionType(Yoga[YOGA_VALUE_MAPPINGS.position[value]])
  }
  sides.forEach(side => {
    const edgeConst = YOGA_VALUE_MAPPINGS.edge[side.toLowerCase()]
    YOGA_SETTERS[side.toLowerCase()] = (yogaNode, value) => {
      yogaNode.setPosition(Yoga[edgeConst], value)
    }
  })

  // Multi-side properties
  ;[
    'margin',
    'padding',
    'border'
  ].forEach(styleProp => {
    sides.forEach(side => {
      const edgeConst = YOGA_VALUE_MAPPINGS.edge[side.toLowerCase()]
      const setter = `set${styleProp.charAt(0).toUpperCase()}${styleProp.substr(1)}`
      YOGA_SETTERS[`${styleProp}${side}`] = (yogaNode, value) => {
        yogaNode[setter](Yoga[edgeConst], value)
      }
    })
  })



  function ensureAllFontsLoaded(styleTree, callback) {
    const fonts = []
    let loadedCount = 0
    walkStyleTree(styleTree, node => {
      if (node.text) fonts.push(node.font) //may be undef
    })
    if (fonts.length) {
      for (let i = 0; i < fonts.length; i++) {
        loadFontFn(fonts[i], () => {
          loadedCount++
          if (loadedCount === fonts.length) {
            callback()
          }
        })
      }
    } else {
      callback()
    }
  }

  function walkStyleTree(styleTree, callback) {
    callback(styleTree)
    if (styleTree.children) {
      for (let i = 0, len = styleTree.children.length; i < len; i++) {
        walkStyleTree(styleTree.children[i], callback)
      }
    }
  }

  function process(styleTree, callback) {
    // Init common node config
    const yogaConfig = Yoga.Config.create()
    yogaConfig.setPointScaleFactor(0) //disable value rounding

    // Ensure all fonts required for measuring text nodes within this layout are pre-loaded,
    // so that all text measurement calls can happen synchronously
    ensureAllFontsLoaded(styleTree, () => {
      // TODO for now, just to keep things simple, we'll rebuild the entire Yoga tree on every
      // call, but we should look into persisting it across calls for more efficient updates

      function populateNode(yogaNode, styleNode) {
        if (!styleNode) {
          throw new Error('Style node with no id')
        }

        for (let prop in styleNode) {
          if (styleNode.hasOwnProperty(prop)) {
            // Look for a style setter, and invoke it
            const setter = YOGA_SETTERS[prop]
            if (setter) {
              setter(yogaNode, styleNode[prop])
            }
            // If the node has text, set up its measurement function
            else if (prop === 'text') {
              yogaNode.setMeasureFunc((innerWidth, widthMeasureMode, innerHeight, heightMeasureMode) => {
                const params = {
                  text: styleNode.text,
                  font: styleNode.font,
                  fontSize: styleNode.fontSize,
                  lineHeight: styleNode.lineHeight,
                  letterSpacing: styleNode.letterSpacing,
                  whiteSpace: styleNode.whiteSpace,
                  overflowWrap: styleNode.overflowWrap,
                  maxWidth: isNaN(innerWidth) ? Infinity : innerWidth
                }
                // NOTE: this assumes the measureFunction will exec the callback synchronously; this works
                // with current impl since we preload all needed fonts above, but it would be good to
                // formalize that contract in the LayoutEngine
                let result = measureFunction(params)
                if (result) {
                  // Apply a fudge factor to avoid issues where the flexbox layout result using this
                  // measurement ends up slightly smaller (due to rounding?) and making text wrap
                  result.width += styleNode.fontSize * 0.00001
                }
                return result || {width: 0, height: 0}
              })
            }
          }
        }

        // Recurse to children
        if (styleNode.children) {
          for (let i = 0, len = styleNode.children.length; i < len; i++) {
            const childYogaNode = Yoga.Node.createWithConfig(yogaConfig)
            populateNode(childYogaNode, styleNode.children[i])
            yogaNode.insertChild(childYogaNode, i)
          }
        }

        // Store the Yoga node on the style object, so we can access each Yoga node's original
        // context when traversing post-layout
        styleNode.yogaNode = yogaNode
      }
      const root = Yoga.Node.createWithConfig(yogaConfig)
      populateNode(root, styleTree)

      // Perform the layout and collect the results as a flat id-to-computed-layout map
      root.calculateLayout()
      const results = Object.create(null)
      walkStyleTree(styleTree, styleNode => {
        const {id, yogaNode} = styleNode
        results[id] = {
          left: yogaNode.getComputedLeft(),
          top: yogaNode.getComputedTop(),
          width: yogaNode.getComputedWidth(),
          height: yogaNode.getComputedHeight()
        }
      })
      root.freeRecursive()

      callback(results)
    })
  }

  return process
}


export const flexLayoutProcessorWorkerModule = defineWorkerModule({
  name: 'FlexLayoutProcessor',
  dependencies: [
    yogaFactory,
    typesetterWorkerModule,
    createFlexLayoutProcessor,
  ],
  init(yogaFactory, layoutEngine, create) {
    const Yoga = yogaFactory()
    function measure(params) {
      let result = null
      layoutEngine.measure(params, r => {result = r})
      return result
    }
    const process = create(Yoga, layoutEngine.loadFont, measure)
    return function(styleTree) {
      return new Promise(resolve => {
        process(styleTree, resolve)
      })
    }
  }
})

