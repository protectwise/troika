import React, {PropTypes as T} from 'react'
import World from './facade/World'
import threejsUtils from 'utils/threejs/threejsUtils'




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
    //shadowMapType: T.oneOf([THREE.BasicShadowMap, THREE.PCFShadowMap, THREE.PCFSoftShadowMap]),
    showStats: T.bool,
    onBackgroundClick: T.func
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


  _onMouseMove(e) {
    this._world.handleMouseMove(e)
  },

  _onClick(e) {
    this._world.handleClick(e)
  },


  render() {
    return (
      <div>
        <canvas
          ref={ this._bindCanvasRef }
          onMouseMove={ this._onMouseMove }
          onClick={ this._onClick }
        />
        
        { /*props.showStats && this._threeJsRenderer ? (
          <threejsUtils.WebGlStats
            ref={ this.bindStatsRef }
            renderer={ this._threeJsRenderer }
          />
        ) : null*/ }
      </div>
    )
  }
})

export default Canvas3D
