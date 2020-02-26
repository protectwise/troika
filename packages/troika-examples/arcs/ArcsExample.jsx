import React from 'react'
import T from 'prop-types'
import {Canvas3D} from 'troika-3d'
import ArcsFacade from './ArcsFacade'
import {refreshArcsData} from './arcsData'
import { ExampleConfigurator } from '../_shared/ExampleConfigurator.js'


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
  }

  _updateData() {
    this.setState({data: refreshArcsData(this.state.data)})
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
          objects={ [{
            key: 'arcs',
            facade: ArcsFacade,
            angled: state.angled,
            derivedLevel: state.derivedLevel,
            wireframe: state.wireframe,
            arcDepth: state.deep ? .2 : 0.0001,
            data: state.data,
            transition: {rotateX: true},
            animation: state.rotate ? {
              from: {rotateZ: 0},
              to: {rotateZ: Math.PI * 2},
              duration: 10000,
              iterations: Infinity
            } : {}
          },
          {
            key: 'config',
            isXR: !!this.props.vr,
            facade: ExampleConfigurator,
            data: state,
            onUpdate: this.setState.bind(this),
            items: [
              {type: 'button', label: 'Randomize Data', onClick: this._updateData},
              {type: 'boolean', label: 'Angled', path: 'angled'},
              {type: 'boolean', label: 'Deep', path: 'deep'},
              {type: 'boolean', label: 'Rotate', path: 'rotate'},
              {type: 'boolean', label: 'Wireframe', path: 'wireframe'},
              {type: 'select', label: 'Shader', path: 'derivedLevel', options: [
                {value: 0, label: 'Fully Custom'},
                {value: 1, label: 'Derived'},
                {value: 2, label: 'Double-Derived'}
              ]}
            ]
          }]}
        />

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
