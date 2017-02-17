import React from 'react'
import World2DFacade from '../facade/canvas2d/World2D'
import HtmlOverlay from './HtmlOverlay.jsx'
const T = React.PropTypes



const Canvas3D = React.createClass({
  displayName: 'Canvas3D',

  propTypes: {
    width: T.number.isRequired,
    height: T.number.isRequired,
    backgroundColor: T.any,
    objects: T.oneOfType([T.array, T.object]).isRequired,
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
    this._world = new World2DFacade(canvas, {
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
    world.onBackgroundClick = props.onBackgroundClick
    world.children = props.objects
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
