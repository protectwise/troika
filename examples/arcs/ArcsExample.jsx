import React from 'react'
import T from 'prop-types'
import {Canvas3D} from '../../src/index'
import ArcsFacade from './ArcsFacade'
import {refreshArcsData} from './arcsData'


const TRANS = {
  duration: 700,
  easing: 'easeOutExpo',
  delay: 200
}


class ArcsExample extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      deep: false,
      cameraAngle: 0,
      data: refreshArcsData(null)
    }

    this._updateData = this._updateData.bind(this)
    this._toggleDepth = this._toggleDepth.bind(this)
    this._toggleCameraAngle = this._toggleCameraAngle.bind(this)
  }

  _updateData() {
    this.setState({data: refreshArcsData(this.state.data)})
  }

  _toggleDepth() {
    this.setState({deep: !this.state.deep})
  }

  _toggleCameraAngle() {
    this.setState({cameraAngle: !this.state.cameraAngle ? -Math.PI / 4 : 0})
  }

  render() {
    let state = this.state
    let {width, height} = this.props

    return (
      <div>
        <Canvas3D
          antialias
          stats={ this.props.stats }
          width={ width }
          height={ height }
          camera={ {
            fov: 75,
            aspect: width / height,
            near: 0.1,
            far: 20000,
            x: 0,
            y: Math.sin(state.cameraAngle || 0) * 400,
            z: Math.cos(state.cameraAngle || 0) * 400,
            lookAt: {x: 0, y: 0, z: 0},
            transition: {
              y: TRANS,
              z: TRANS
            }
          } }
          objects={ {
            key: 'arcs',
            facade: ArcsFacade,
            angled: state.cameraAngle !== 0,
            arcDepth: state.deep ? 20 : 0.0001,
            data: state.data
          } }
        />

        <div className="example_controls">
          <button onClick={ this._updateData }>Randomize Data</button>
          <button onClick={ this._toggleCameraAngle }>Toggle Angle</button>
          <button onClick={ this._toggleDepth }>Toggle Depth</button>
        </div>

        <div className="example_desc">
          <p>Each arc is defined and animated using four logical properties: start/end angle and start/end radius.</p>
          <p>The arc meshes all share a 1x1x1 box geometry, whose vertices are transformed to form the arc shapes. That transformation is done entirely on the GPU in a vertex shader, with those four logical properties passed in as uniforms.</p>
        </div>
      </div>
    )
  }
}

ArcsExample.propTypes = {
  width: T.number,
  height: T.number
}

export default ArcsExample
