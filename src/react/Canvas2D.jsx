import {assignIf} from '../utils'
import React from 'react'
import T from 'prop-types'
import World2DFacade from '../facade/canvas2d/World2D'
import CanvasBase, {commonPropTypes} from './CanvasBase.jsx'

class Canvas2D extends CanvasBase {
  constructor(props) {
    super(props)
    this.initWorld = this.initWorld.bind(this)
    this.updateWorld = this.updateWorld.bind(this)
  }

  initWorld(canvas) {
    let world = new World2DFacade(canvas)
    world.renderHtmlItems = this.renderHtmlItems
    return world
  }

  updateWorld(world) {
    let props = this.props
    world.width = props.width
    world.height = props.height
    world.pixelRatio = props.pixelRatio
    world.backgroundColor = props.backgroundColor
    world.onBackgroundClick = props.onBackgroundClick
    world.children = props.objects
    world.afterUpdate()
  }
}

Canvas2D.displayName = 'Canvas2D'

Canvas2D.propTypes = assignIf({
  backgroundColor: T.any,
  objects: T.oneOfType([T.array, T.object]).isRequired,
  onBackgroundClick: T.func
}, commonPropTypes)

export default Canvas2D
