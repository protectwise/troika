import React from 'react'
import World from '../facade/World'
import HtmlOverlay from './HtmlOverlay.jsx'
const T = React.PropTypes



const Canvas3D = React.createClass({
  displayName: 'Canvas3D',

  propTypes: {
    width: T.number.isRequired,
    height: T.number.isRequired,
    backgroundColor: T.any,
    lights: T.array,
    camera: T.object.isRequired,
    objects: T.oneOfType([T.array, T.object]).isRequired,
    antialias: T.bool,
    showStats: T.bool,
    onBackgroundClick: T.func,
    className: T.string,
    cursor: T.string
  },

  componentDidUpdate() {
    this.updateWorld()
  },

  _bindCanvasRef(canvas) {
    if (canvas) {
      this.initWorld(canvas)
      this.updateWorld()
    } else {
      this.destroyWorld()
    }
  },

  _bindStatsRef(stats) {
    this._glStats = stats
  },

  initWorld(canvas) {
    let props = this.props
    this._world = new World(canvas, {
      antialias: props.antialias
    })
    this._world.renderHtmlItems = this.renderHtmlItems
  },

  updateWorld() {
    let props = this.props
    let world = this._world
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
  },

  destroyWorld() { //just to see it burn
    if (this._world) {
      this._world.destructor()
      delete this._world
    }
  },

  renderHtmlItems(items) {
    if (this._htmlOverlayRef) {
      this._htmlOverlayRef.setItems(items)
    }
  },

  _bindHtmlOverlayRef(cmp) {
    this._htmlOverlayRef = cmp
  },

  render() {
    let {props} = this
    return (
      <div className={ props.className } style={ {
        position: 'relative',
        overflow: 'hidden',
        width: props.width,
        height: props.height,
        cursor: props.cursor,
        userSelect: 'none'
      } }>
        <canvas ref={ this._bindCanvasRef } />
        <HtmlOverlay ref={ this._bindHtmlOverlayRef } />
      </div>
    )
  }
})

export default Canvas3D
