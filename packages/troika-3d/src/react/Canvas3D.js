import React from 'react'
import T from 'prop-types'
import { ReactCanvasBase, utils } from 'troika-core'
import World3DFacade from '../facade/World3DFacade.js'


class Canvas3D extends ReactCanvasBase {
  constructor(props) {
    super(props)
    this._onCanvasRef = canvas => {
      let fn = this.context.onCanvasRef
      if (fn) fn(canvas)
      fn = this.props.onCanvasRef
      if (fn) fn(canvas)
    }
  }

  render() {
    const {props, context} = this
    return React.createElement(
      ReactCanvasBase,
      utils.assign({}, props, {
        onCanvasRef: this._onCanvasRef,
        canvasStyle: props.canvasStyle || context.canvasStyle,
        worldFacade: props.worldFacade || context.worldFacade || World3DFacade,
        worldProps: utils.assign(
          {
            antialias: props.antialias,
            rendererClass: props.rendererClass,
            backgroundColor: props.backgroundColor,
            shadows: props.shadows,
            camera: props.camera,
            lights: props.lights,
            objects: props.objects,
            fog: props.fog,
            onBackgroundClick: props.onBackgroundClick
          },
          context.worldProps,
          props.worldProps
        )
      }),
      props.children
    )
  }
}

Canvas3D.displayName = 'Canvas3D'

Canvas3D.propTypes = utils.assignIf(
  {
    backgroundColor: T.any,
    lights: T.array,
    camera: T.object,
    objects: T.oneOfType([T.array, T.object]).isRequired,
    antialias: T.bool,
    onBackgroundClick: T.func,
    rendererClass: T.func
  },
  ReactCanvasBase.commonPropTypes
)

/**
 * Ancestors React components may provide these context values to override
 * how the world is created, e.g. switching to a WebXR-aware world impl
 */
Canvas3D.contextType = React.createContext({
  worldFacade: World3DFacade,
  worldProps: {},
  onCanvasRef: null,
  canvasStyle: null
})

export default Canvas3D
