import defaults from 'lodash/defaults'
import React from 'react'
import World3DFacade from '../facade/threejs/World3D'
import {commonMethods, commonPropTypes} from './CanvasBase.jsx'
const T = React.PropTypes



const Canvas3D = React.createClass(defaults({
  displayName: 'Canvas3D',

  propTypes: defaults({
    backgroundColor: T.any,
    lights: T.array,
    camera: T.object.isRequired,
    objects: T.oneOfType([T.array, T.object]).isRequired,
    antialias: T.bool,
    onBackgroundClick: T.func
  }, commonPropTypes),

  initWorld(canvas) {
    let world = new World3DFacade(canvas, {
      antialias: this.props.antialias
    })
    world.renderHtmlItems = this.renderHtmlItems
    return world
  },

  updateWorld(world) {
    let props = this.props
    world.width = props.width
    world.height = props.height
    world.backgroundColor = props.backgroundColor
    world.shadows = props.shadows
    world.camera = props.camera
    world.scene = {
      lights: props.lights,
      children: props.objects,
      fog: props.fog,
      onClick: props.onBackgroundClick
    }
    world.afterUpdate()
  }
}, commonMethods))


export default Canvas3D
