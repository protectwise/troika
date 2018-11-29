import React from 'react'
import T from 'prop-types'
import {Canvas2D, ListFacade, Object2DFacade} from 'troika-2d'
import {Easings} from 'troika-animation'


class EasingCurve extends Object2DFacade {
  constructor(parent) {
    super(parent)
    this.width = 120
    this.height = 60
    this.children = {
      facade: EasingMarker,
      y1: this.height,
      y2: 0,
      x1: 0,
      x2: this.width,
      progress: 0,
      transition: {progress: {duration: 100}},
      animation: {}
    }
  }

  afterUpdate() {
    this.children.easing = this.easing
    this.children.animation = this.animating ? {
      0: {progress: 0},
      75: {progress: 1},
      duration: 2000,
      iterations: Infinity
    } : {}
    super.afterUpdate()
  }

  render(ctx) {
    const {width:w, height:h} = this
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#fff'
    ctx.font = '13px sans-serif'
    ctx.fillText(this.easing, 0, -10)

    const easingFn = Easings[this.easing]
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let i = 0; i <= 100; i += 1) {
      ctx.lineTo(i / 100 * w, h - easingFn(i / 100) * h)
    }
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

class EasingMarker extends Object2DFacade {
  render(ctx) {
    const {x1, x2, y1, y2, progress} = this
    const x = x1 + (x2 - x1) * progress
    const y = y1 + (y2 - y1) * Easings[this.easing](progress)

    // x progress line
    ctx.fillStyle = '#666'
    ctx.fillRect(x, y1, 1, y2 - y1)

    // dot and y marker
    ctx.beginPath()
    ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.moveTo(x2, y)
    ctx.lineTo(x2 + 4, y - 4)
    ctx.lineTo(x2 + 20, y - 4)
    ctx.lineTo(x2 + 20, y + 4)
    ctx.lineTo(x2 + 4, y + 4)
    ctx.closePath()
    ctx.fillStyle = 'red'
    ctx.fill()
  }
}


class EasingsExample extends React.Component {
  constructor(props) {
    super(props)
    this.state = {animatingAll: false}
  }

  render() {
    let {width, height} = this.props

    return (
      <div>
        <Canvas2D
          stats={ this.props.stats }
          width={ width }
          height={ height }
          objects={ {
            facade: ListFacade,
            data: Object.keys(Easings),
            template: {
              facade: EasingCurve,
              key: d => d,
              easing: d => d,
              x: (d, i) => 50 + (i > 0 ? Math.abs((i - 1) % 6) * 160 : 0),
              y: (d, i) => 100 + (i > 0 ? Math.floor((i - 1) / 6 + 1) * 120 : 0),
              animating: this.state.animatingAll || false,
              pointerStates: {
                hover: {
                  animating: true
                }
              }
            }
          } }
        />

        <div className="example_desc">
          Demonstration of Troika's built-in animation easings, ala <a href="https://easings.net/">easings.net</a>. Hover individual easings to animate them.
        </div>

        <div className="example_controls">
          <label>
            <input type="checkbox" checked={this.state.animatingAll} onChange={e => {
              this.setState({animatingAll: e.target.checked})
            }} /> Animate All
          </label>
        </div>
      </div>
    )
  }
}

EasingsExample.propTypes = {
  width: T.number,
  height: T.number
}

export default EasingsExample