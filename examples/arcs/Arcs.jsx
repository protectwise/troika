import React from 'react'
import {Canvas3D, OrthographicCamera, List} from '../../src/index'
import Arc from './Arc'


const TRANS = {
  duration: 700,
  easing: 'easeOutExpo'
}



export default React.createClass({
  propTypes: {
    width: React.PropTypes.number,
    height: React.PropTypes.number
  },

  componentWillMount() {
    this._randomizeData()
  },

  _randomizeData() {
    let data = {}
    ;['ne1', 'nw1', 'sw1', 'se1', 'ne2', 'nw2', 'sw2', 'se2'].forEach(key => {
      data[key] = []
      let angle = 0
      let numArcs = Math.round(Math.random() * 15)
      let marginAngle = 0.0075
      for (let i = 0; i < numArcs; i++) {
        data[key].push({
          startAngle: angle + marginAngle,
          endAngle: (angle += Math.max(Math.random() * Math.PI / 2 / numArcs, 0.02)) - marginAngle
        })
      }
    })
    this.setState({data})
  },

  render() {
    let state = this.state || {data: {}}
    let {width, height} = this.props

    function quadrant(key, baseAngle, baseRadius) {
      return {
        key: key,
        class: List,
        data: state.data[key] || [],
        template: {
          key: (d, i) => i,
          class: Arc,
          startAngle: d => baseAngle + d.startAngle,
          endAngle: d => baseAngle + d.endAngle,
          startRadius: baseRadius,
          animation: (d, i) => ({
            from: {
              opacity: 0,
              endRadius: baseRadius
            },
            to: {
              opacity: 1,
              endRadius: baseRadius + 30
            },
            duration: TRANS.duration,
            easing: TRANS.easing,
            delay: i * 50
          }),
          transition: {
            startAngle: TRANS,
            endAngle: TRANS
          }
        }
      }
    }

    return (
      <div>
        <Canvas3D
          antialias
          width={ width }
          height={ height }
          camera={ {
            class: OrthographicCamera,
            left: -width / 2,
            right: width / 2,
            top: height / 2,
            bottom: -height / 2,
            near: 0.1,
            far: 20000,
            x: 0,
            y: 0,
            z: 1,
            lookAt: {x: 0, y: 0, z: 0}
          } }
          objects={ [
            quadrant('ne1', 0, 100),
            quadrant('nw1', Math.PI / 2, 100),
            quadrant('sw1', Math.PI, 100),
            quadrant('se1', Math.PI * 3 / 2, 100),
            quadrant('ne2', 0, 150),
            quadrant('nw2', Math.PI / 2, 150),
            quadrant('sw2', Math.PI, 150),
            quadrant('se2', Math.PI * 3 / 2, 150)
          ] }
        />

        <div className="example_controls">
          <button onClick={ this._randomizeData }>Randomize Data</button>
        </div>

        <div className="example_desc">
          <p>Each arc is defined and animated using four logical properties: start/end angle and start/end radius.</p>
          <p>The arc meshes all share a 1x1 plane geometry, whose vertices are transformed to form the arc shapes on the GPU by a vertex shader.</p>
        </div>
      </div>
    )
  }
})

