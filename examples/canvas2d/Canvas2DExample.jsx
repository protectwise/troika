import React from 'react'
import {Canvas2D, Group2DFacade, Object2DFacade} from '../../src/index'



class CircleFacade extends Object2DFacade {
  constructor(...args) {
    super(...args)
    this.onMouseOver = e => {
      this.hovered = true
    }
    this.onMouseOut = e => {
      this.hovered = false
    }
  }

  render(ctx) {
    ctx.beginPath()
    ctx.arc(0, 0, this.r, 0, Math.PI * 2)
    if (this.fill) {
      ctx.fillStyle = this.hovered ? '#fff' : this.fill
      ctx.fill()
    }
    if (this.stroke) {
      ctx.lineWidth = 5
      ctx.strokeStyle = this.hovered ? '#fff' : this.stroke
      ctx.stroke()
    }
  }
}



export default React.createClass({
  propTypes: {
    width: React.PropTypes.number,
    height: React.PropTypes.number
  },

  getInitialState() {
    return {
    }
  },

  render() {
    let state = this.state
    let {width, height} = this.props

    return (
      <div>
        <Canvas2D
          width={ width }
          height={ height }
          objects={ [
            {
              key: 'circle1',
              class: CircleFacade,
              x: 100,
              y: 100,
              r: 50,
              fill: 'blue',
              animation: {
                from: {r: 20},
                to: {r: 50},
                duration: 1000,
                iterations: Infinity,
                direction: 'alternate'
              }
            },
            {
              key: 'circle2',
              class: CircleFacade,
              x: 100,
              y: 300,
              r: 50,
              stroke: 'blue',
              animation: {
                from: {r: 20, scaleX: 1},
                to: {r: 50, scaleX: 2},
                duration: 1000,
                iterations: Infinity,
                direction: 'alternate'
              }
            },
            {
              key: 'group1',
              class: Group2DFacade,
              x: 300,
              y: 300,
              scaleY: 2,
              animation: {
                from: {rotate: 0},
                to: {rotate: Math.PI * 2},
                duration: 5000,
                iterations: Infinity
              },
              children: [
                {
                  key: 'circle1',
                  class: CircleFacade,
                  x: -100,
                  r: 25,
                  fill: '#090',
                  scaleY: 2,
                  animation: {
                    from: {rotate: 0},
                    to: {rotate: Math.PI * 2},
                    duration: 2000,
                    iterations: Infinity,
                  }
                },
                {
                  key: 'circle2',
                  class: CircleFacade,
                  x: 100,
                  r: 25,
                  stroke: '#090',
                  scaleY: 2,
                  animation: {
                    from: {rotate: 0},
                    to: {rotate: Math.PI * -2},
                    duration: 2000,
                    iterations: Infinity,
                  }
                }
              ]
            }
          ] }
        />

        <div className="example_desc">
        </div>

        <div className="example_controls">
        </div>
      </div>
    )
  }
})

