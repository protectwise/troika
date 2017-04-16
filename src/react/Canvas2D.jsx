import {assignIf} from '../utils'
import React from 'react'
import World2DFacade from '../facade/canvas2d/World2D'
import {commonMethods, commonPropTypes} from './CanvasBase.jsx'
const T = React.PropTypes



const Canvas2D = React.createClass(assignIf({
  displayName: 'Canvas2D',

  propTypes: assignIf({
    backgroundColor: T.any,
    objects: T.oneOfType([T.array, T.object]).isRequired,
    onBackgroundClick: T.func
  }, commonPropTypes),

  initWorld(canvas) {
    let world = new World2DFacade(canvas)
    world.renderHtmlItems = this.renderHtmlItems
    return world
  },

  updateWorld(world) {
    let props = this.props
    world.width = props.width
    world.height = props.height
    world.backgroundColor = props.backgroundColor
    world.onBackgroundClick = props.onBackgroundClick
    world.children = props.objects
    world.afterUpdate()
  }
}, commonMethods))


export default Canvas2D
