import {defineWorkerModule} from '../../../WorkerModules'
import {fontProcessorWorkerModule} from '../text/TextBuilder'
import {BasicThenable} from '../../../utils'

function createFlexLayoutProcessor(loadFontFn, measureFn) {
  
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
  // Top/right/bottom/left properties
  ;[
    'margin',
    'padding',
    'border'
  ].forEach(styleProp => {
    ['Top', 'Right', 'Bottom', 'Left'].forEach(side => {
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

  let Yoga = null
  function loadYogaLib() {
    if (!Yoga) {
      const paths = {
        './YGEnums': 'https://cdn.jsdelivr.net/npm/yoga-layout@1.9.3/dist/YGEnums.min.js',
        '../build/Release/nbind.js': 'https://cdn.jsdelivr.net/npm/yoga-layout@1.9.3/build/Release/nbind.min.js',
        './entry-common': 'https://cdn.jsdelivr.net/npm/yoga-layout@1.9.3/dist/entry-common.min.js',
        main: 'https://cdn.jsdelivr.net/npm/yoga-layout@1.9.3/dist/entry-browser.min.js'
      }

      function require(scriptId) {
        // Synchronously load the script content
        const xhr = new XMLHttpRequest()
        xhr.open('GET', paths[scriptId], false)
        xhr.send()

        // Execute as a wrapped function, given our local require impl and a module object,
        // and return the exports that the script attached
        const module = {exports: {}}
        new Function('require', 'module', `${xhr.responseText}`)(require, module)
        return module.exports
      }

      // Kick it off with the entry point script
      Yoga = require('main')
    }
    return Yoga
  }

  function process(styleTree, callback) {
    // Make sure the lib is loaded
    loadYogaLib()

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
                  maxWidth: innerWidth
                }
                // TODO: this assumes the measureFn will exec the callback synchronously; this works
                // with current impl since we preload all needed fonts above, but it would be good to
                // formalize that contract in the FontProcessor
                let result = null
                measureFn(params, r => {result = r})
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


const flexLayoutProcessorWorkerModule = defineWorkerModule({
  dependencies: [
    fontProcessorWorkerModule,
    createFlexLayoutProcessor,
    BasicThenable
  ],
  init({loadFont, measure}, create, BasicThenable) {
    const process = create(loadFont, measure)
    return function(styleTree) {
      const thenable = new BasicThenable()
      process(styleTree, thenable.resolve)
      return thenable
    }
  }
})

export function requestFlexLayout(styleTree, callback) {
  flexLayoutProcessorWorkerModule(styleTree).then(callback)
}




/*
const styleTreeExample = {
  id, //required!

  width,
  height,
  minWidth,
  minHeight,
  maxWidth,
  maxHeight,
  flexDirection,
  flex,
  flexWrap,
  flexBasis,
  flexGrow,
  flexShrink,
  alignContent,
  alignItems,
  alignSelf,
  justifyContent,
  position,
  left,
  right,
  top,
  bottom,
  marginTop,
  marginRight,
  marginBottom,
  marginLeft,
  paddingTop,
  paddingRight,
  paddingBottom,
  paddingLeft,
  borderTop,
  borderRight,
  borderBottom,
  borderLeft,

  text,
  font,
  fontSize,
  lineHeight,
  letterSpacing,
    
  children: [{
    //...
  }]
}
*/
