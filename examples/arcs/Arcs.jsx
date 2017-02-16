import React from 'react'
import {Canvas3D, ListFacade} from '../../src/index'
import Arc from './Arc'


const TRANS = {
  duration: 700,
  easing: 'easeOutExpo',
  delay: 200
}
let idCtr = 1


export default React.createClass({
  propTypes: {
    width: React.PropTypes.number,
    height: React.PropTypes.number
  },

  getInitialState() {
    return {
      deep: false,
      cameraAngle: 0,
      highlightedArc: null,
      data: {}
    }
  },

  componentWillMount() {
    this._randomizeData()
  },

  _randomizeData() {
    let oldData = this.state.data || {}
    let data = {}
    ;['ne1', 'nw1', 'sw1', 'se1', 'ne2', 'nw2', 'sw2', 'se2'].forEach(key => {
      data[key] = []
      // carry forward a random selection of previous items
      if (oldData[key]) {
        oldData[key].forEach(d => {
          if (Math.random() > .5) {
            d.isNew = false
            data[key].push(d)
          }
        })
      }
      let angle = 0
      let numArcs = Math.max(data[key].length, Math.round(Math.random() * 20))
      let marginAngle = 0.0075
      for (let i = 0; i < numArcs; i++) {
        if (!data[key][i]) {
          data[key].push({
            id: idCtr++,
            isNew: true
          })
        }
        data[key][i].startAngle = angle + marginAngle
        data[key][i].endAngle = (angle += Math.max(Math.random() * Math.PI / 2 / numArcs, 0.02)) - marginAngle
      }
    })
    this.setState({data})
  },

  _toggleDepth() {
    this.setState({deep: !this.state.deep})
  },

  _toggleCameraAngle() {
    this.setState({cameraAngle: !this.state.cameraAngle ? -Math.PI / 4 : 0})
  },

  _onArcMouseOver(e) {
    this.setState({highlightedArc: e.target.id})
  },

  _onArcMouseOut() {
    this.setState({highlightedArc: null})
  },

  render() {
    let state = this.state
    let {width, height} = this.props
    let angled = state.cameraAngle != 0
    let onArcMouseOver = () => this._onArcMouseOver
    let onArcMouseOut = () => this._onArcMouseOut

    function quadrant(key, baseAngle, baseRadius) {
      return {
        key: key,
        class: ListFacade,
        data: state.data[key] || [],
        template: {
          key: d => d.id,
          class: Arc,
          id: d => d.id,
          startAngle: d => baseAngle + d.startAngle,
          endAngle: d => baseAngle + d.endAngle,
          startRadius: baseRadius,
          scaleZ: state.deep ? 20 : .0001,
          highlight: d => d.id === state.highlightedArc,
          onMouseOver: onArcMouseOver,
          onMouseOut: onArcMouseOut,
          animation: (d, i) => (d.isNew ? {
            from: {
              opacity: 0,
              endRadius: baseRadius + 1
            },
            to: {
              opacity: 1,
              endRadius: baseRadius + 30
            },
            duration: TRANS.duration,
            easing: TRANS.easing,
            delay: 200 + i * 50
          } : null),
          exitAnimation: {
            from: {
              opacity: 1,
              z: 0,
              endRadius: baseRadius + 30
            },
            to: {
              opacity: 0,
              z: angled ? -100 : 0,
              endRadius: baseRadius + (angled ? 30 : 1)
            },
            duration: 500,
            easing: TRANS.easing
          },
          transition: {
            startAngle: TRANS,
            endAngle: TRANS,
            scaleZ: TRANS
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
})

