import React from 'react'
import T from 'prop-types'
import {Canvas3D} from 'troika-3d'
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
      deep: true,
      angled: true,
      rotate: false,
      derivedLevel: 0,
      data: refreshArcsData(null)
    }

    this._updateData = this._updateData.bind(this)
    this._toggleDepth = this._toggleDepth.bind(this)
    this._toggleRotate = this._toggleRotate.bind(this)
    this._toggleAngled = this._toggleAngled.bind(this)
    this._setDerived = this._setDerived.bind(this)
  }

  _updateData() {
    this.setState({data: refreshArcsData(this.state.data)})
  }

  _toggleDepth() {
    this.setState({deep: !this.state.deep})
  }

  _toggleRotate() {
    this.setState({rotate: !this.state.rotate})
  }

  _toggleAngled() {
    this.setState({angled: !this.state.angled})
  }

  _setDerived(e) {
    this.setState({derivedLevel: +e.target.value})
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
          lights={ [
            {
              type: 'point',
              z: 2,
              x: 0,
              y: 1
            },
            {
              type: 'ambient',
              intensity: 0.5
            }
          ] }
          camera={ {
            fov: 75,
            aspect: width / height,
            near: 0.001,
            far: 10,
            z: 4,
            lookAt: {x: 0, y: 0, z: 0},
            transition: {
              y: TRANS,
              z: TRANS
            }
          } }
          objects={ {
            key: 'arcs',
            facade: ArcsFacade,
            angled: state.angled,
            derivedLevel: state.derivedLevel,
            arcDepth: state.deep ? .2 : 0.0001,
            data: state.data,
            rotateX: state.angled ? -Math.PI / 4 : 0,
            transition: {rotateX: true},
            animation: state.rotate ? {
              from: {rotateZ: 0},
              to: {rotateZ: Math.PI * 2},
              duration: 10000,
              iterations: Infinity
            } : {}
          } }
        />

        <div className="example_controls">
          <button onClick={ this._updateData }>Randomize Data</button>
          <label><input type="checkbox" checked={state.angled} onChange={ this._toggleAngled } /> Angled</label>
          <label><input type="checkbox" checked={state.deep} onChange={ this._toggleDepth } /> Deep</label>
          <label><input type="checkbox" checked={state.rotate} onChange={ this._toggleRotate } /> Rotate</label>
          <select onChange={ this._setDerived }>
            <option value={0}>Shader: Fully Custom</option>
            <option value={1}>Shader: Derived</option>
            <option value={2}>Shader: Double-Derived</option>
          </select>
        </div>

        <div className="example_desc">
          <p>Each arc is defined and animated using four logical properties: start/end angle and start/end radius.</p>
          <p>The arc meshes all share a 1x1x1 box geometry, whose vertices are transformed to form the arc shapes. That transformation is done entirely on the GPU in a vertex shader, with those four logical properties passed in as uniforms. Two versions of the custom vertex shader are supplied: a minimal one written totally from scratch using ShaderMaterial, and one derived from MeshStandardMaterial using the createDerivedMaterial utility.</p>
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
