import React from 'react'
import T from 'prop-types'
import { ReactCanvasBase, utils } from 'troika-core'
import World2DFacade from '../facade/World2DFacade'

class Canvas2D extends React.Component {
  render() {
    const {props} = this
    return React.createElement(
      ReactCanvasBase,
      utils.assign({}, props, {
        worldClass: props.worldClass || World2DFacade,
        worldProps: utils.assign({}, {
          backgroundColor: props.backgroundColor,
          onBackgroundClick: props.onBackgroundClick,
          objects: props.objects
        }, props.worldProps)
      }),
      props.children
    )
  }
}

Canvas2D.displayName = 'Canvas2D'

Canvas2D.propTypes = utils.assignIf(
  {
    backgroundColor: T.any,
    objects: T.oneOfType([T.array, T.object]).isRequired,
    onBackgroundClick: T.func
  },
  ReactCanvasBase.commonPropTypes
)

export default Canvas2D
