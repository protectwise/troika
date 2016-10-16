import React, {PropTypes as T} from 'react'
import World from '../facade/World'



const HtmlOverlay = React.createClass({
  displayName: 'Canvas3D.HtmlOverlay',

  ctStyles: {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none'
  },

  getInitialState() {
    return {
      items: []
    }
  },

  setItems(items) {
    this.setState({items: items || []})
  },

  render() {
    return (
      <div style={ this.ctStyles }>
        { this.state.items.map(({key, html, x, y}) => {
          return (
            <div key={ key } style={ {
              position: 'absolute',
              transform: `translate(${ x }px, ${ y }px)`}
            }>
              { html }
            </div>
          )
        }) }
      </div>
    )
  }
})



const Canvas3D = React.createClass({
  displayName: 'Canvas3D',

  propTypes: {
    width: T.number.isRequired,
    height: T.number.isRequired,
    backgroundColor: T.any,
    lights: T.array,
    camera: T.object.isRequired,
    objects: T.array.isRequired,
    antialias: T.bool,
    showStats: T.bool,
    onBackgroundClick: T.func,
    className: T.string
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
    world.camera = props.camera
    world.scene = {
      lights: props.lights,
      children: props.objects,
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

  _onMouseMove(e) {
    this._world.handleMouseMoveEvent(e)
  },

  _onMouseButton(e) {
    this._world.handleMouseButtonEvent(e)
  },


  render() {
    return (
      <div className={ this.props.className }>
        <canvas
          ref={ this._bindCanvasRef }
          onMouseMove={ this._onMouseMove }
          onMouseOut={ this._onMouseMove }
          onClick={ this._onMouseButton }
          onMouseDown={ this._onMouseButton }
          onMouseUp={ this._onMouseButton }
          onDoubleClick={ this._onMouseButton }
        />
        
        { /*props.showStats && this._threeJsRenderer ? (
          <threejsUtils.WebGlStats
            ref={ this.bindStatsRef }
            renderer={ this._threeJsRenderer }
          />
        ) : null*/ }

        <HtmlOverlay ref={ this._bindHtmlOverlayRef } />
      </div>
    )
  }
})

export default Canvas3D
