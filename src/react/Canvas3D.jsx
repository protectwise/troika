import {assign, assignIf} from '../utils'
import T from 'prop-types'
import World3DFacade from '../facade/threejs/World3DFacade'
import CanvasBase, { commonPropTypes } from './CanvasBase.jsx'
import {vrAwareContextTypes} from './VrAware.jsx'

class Canvas3D extends CanvasBase {
  initWorld(canvas) {
    let world = new World3DFacade(canvas)
    world.renderHtmlItems = this.renderHtmlItems
    return world
  }

  updateWorld(world) {
    let {props, context} = this
    world.width = props.width
    world.height = props.height
    world.pixelRatio = props.pixelRatio
    world.antialias = props.antialias
    world.rendererClass = props.rendererClass
    world.backgroundColor = props.backgroundColor
    world.shadows = props.shadows
    world.camera = props.camera
    world.lights = props.lights
    world.objects = props.objects
    world.fog = props.fog
    world.onBackgroundClick = props.onBackgroundClick
    world.continuousRender = props.continuousRender
    world.onStatsUpdate = props.stats ? this.updateStats : null
    world.vrDisplay = (context && context.vrDisplay) || null
    world.afterUpdate()
  }

  _bindCanvasRef(canvas) {
    super._bindCanvasRef(canvas)

    // Pass the canvas up to a VrAware ancestor
    const registerVrCanvas = this.context && this.context.registerVrCanvas
    if (registerVrCanvas) {
      registerVrCanvas(canvas)
    }
  }
}

Canvas3D.displayName = 'Canvas3D'

Canvas3D.propTypes = assignIf(
  {
    backgroundColor: T.any,
    lights: T.array,
    camera: T.object.isRequired,
    objects: T.oneOfType([T.array, T.object]).isRequired,
    antialias: T.bool,
    onBackgroundClick: T.func,
    rendererClass: T.func
  },
  commonPropTypes
)

Canvas3D.contextTypes = assign({}, vrAwareContextTypes)

export default Canvas3D
