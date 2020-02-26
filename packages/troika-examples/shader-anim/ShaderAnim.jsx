import React from 'react'
import T from 'prop-types'
import {Canvas3D} from 'troika-3d'
import {LavaCube, WaterCube} from './Cube'
import {Fireball} from './Fireball'
import { ExampleConfigurator } from '../_shared/ExampleConfigurator.js'

const TRANS = {
  duration: 700,
  easing: 'easeOutExpo'
}

class ShaderAnim extends React.Component {
  constructor(props) {
    super(props)
    this.state = {}
    this._randomRotate = this._randomRotate.bind(this)
  }

  componentWillMount() {
    this._randomRotate()
  }

  _randomRotate() {
    this.setState({
      rotateX: Math.random() * Math.PI,
      rotateY: Math.random() * Math.PI,
      rotateZ: Math.random() * Math.PI
    })
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
            angle: 45,
            aspect: width / height,
            near: 0.1,
            far: 20000,
            x: 0,
            y: 100,
            z: 400,
            lookAt: {x: 0, y: 0, z: 0}
          } }
          objects={ [
            {
              key: 'lava',
              facade: LavaCube,
              x: -100,
              y: 75,
              rotateX: state.rotateX,
              rotateY: state.rotateY,
              rotateZ: state.rotateZ,
              // To animate the shader's 'time' uniform, apply a normal property animation over a very long duration
              animation: {
                from: {time: 0},
                to: {time: 1e97},
                duration: 1e100
              },
              transition: {
                rotateX: TRANS,
                rotateY: TRANS,
                rotateZ: TRANS
              }
            },
            {
              key: 'water',
              facade: WaterCube,
              x: 100,
              y: 75,
              rotateX: state.rotateX,
              rotateY: state.rotateY,
              rotateZ: state.rotateZ,
              animation: {
                from: {time: 0},
                to: {time: 1e97},
                duration: 1e100
              },
              transition: {
                rotateX: TRANS,
                rotateY: TRANS,
                rotateZ: TRANS
              }
            },
            {
              key: 'fireball',
              facade: Fireball,
              x: 0,
              y: -75,
              rotateX: state.rotateX,
              rotateY: state.rotateY,
              rotateZ: state.rotateZ,
              animation: {
                from: {time: 0},
                to: {time: 1e97},
                duration: 1e100
              },
              transition: {
                rotateX: TRANS,
                rotateY: TRANS,
                rotateZ: TRANS
              }
            },
            {
              key: 'config',
              isXR: !!this.props.vr,
              facade: ExampleConfigurator,
              data: state,
              onUpdate: this.setState.bind(this),
              items: [
                {type: 'button', onClick: this._randomRotate, label: 'Rotate Items'}
              ]
            }
          ] }
        />

        <div className="example_desc">
          <p>Demonstration of shaders using an animated 'time' uniform.</p>
          <p>Based off Lee Stemkoski's <a href="https://stemkoski.github.io/Three.js/Shader-Animate.html">Shader - Animated Materials</a> and <a href="https://stemkoski.github.io/Three.js/Shader-Fireball.html">Shader - Animated Fireball</a> examples.</p>
        </div>
      </div>
    )
  }
}

ShaderAnim.propTypes = {
  width: T.number,
  height: T.number
}

export default ShaderAnim
