import React from 'react'
import {Canvas3D} from '../../src/index'
import {LavaCube, WaterCube} from './Cube'

const TRANS = {
  duration: 700,
  easing: 'easeOutExpo'
}



export default React.createClass({
  componentWillMount() {
    this._randomRotate()
  },

  _randomRotate() {
    this.setState({
      rotateX: Math.random() * Math.PI,
      rotateY: Math.random() * Math.PI,
      rotateZ: Math.random() * Math.PI
    })
  },

  render() {
    let state = this.state
    let width = 1200
    let height = 800
    return (
      <div style={ {padding: 20} }>
        <Canvas3D
          antialias
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
              class: LavaCube,
              x: -100,
              y: 50,
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
              class: WaterCube,
              x: 100,
              y: 50,
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
            }
          ] }
        />

        <p>Demonstration of shaders using an animated 'time' uniform.</p>
        <p>Based off <a href="https://stemkoski.github.io/Three.js/Shader-Animate.html">Lee Stemkoski's Example</a>.</p>

        <div style={ {position: 'absolute', top: 10, right: 10} }>
          <button onClick={ this._randomRotate }>Rotate Cubes</button>
        </div>
      </div>
    )
  }
})

