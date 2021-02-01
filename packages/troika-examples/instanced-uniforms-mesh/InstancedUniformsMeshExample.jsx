import React from 'react'
import T from 'prop-types'
import {Canvas3D} from 'troika-3d'
import { ExampleConfigurator } from '../_shared/ExampleConfigurator.js'
import { Beziers } from './Beziers.js'


class InstancedUniformsMeshExample extends React.Component {
  constructor(props) {
    super(props)
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
            { type: 'directional', x: 0, y: 1, z: 1 }
          ] }
          camera={ {
            z: 5,
          } }
          objects={ [
            {
              facade: Beziers,
              animation: [
                {
                  from: {rotateX: 0},
                  to: {rotateX: Math.PI * 2},
                  duration: 13000,
                  iterations: Infinity
                },
                {
                  from: {rotateY: 0},
                  to: {rotateY: Math.PI * 2},
                  duration: 40000,
                  iterations: Infinity
                }
              ]
            }
            /*{
              key: 'config',
              isXR: !!this.props.vr,
              facade: ExampleConfigurator,
              data: state,
              onUpdate: this.setState.bind(this),
              items: [
                {type: 'boolean', path: 'wireframe', label: 'Wireframe'}
              ]
            }*/
          ] }
        />

        <div className="example_desc">
          <p>Demonstration of InstancedUniformsMesh from the <a href="https://github.com/protectwise/troika/tree/master/packages/three-instanced-uniforms-mesh">three-instanced-uniforms-mesh</a> package.</p>
        </div>
      </div>
    )
  }
}

InstancedUniformsMeshExample.propTypes = {
  width: T.number,
  height: T.number
}

export default InstancedUniformsMeshExample
