import React from 'react'
import {Canvas3D, OrthographicCamera} from '../../src/index'
import Curve from './Curve'


const RAND_STRATEGIES = ['absolute', 'distance']

// Custom interpolator function for transitioning the values array
function interpolateArray(fromValue, toValue, progress) {
  let interpolated = new Float32Array(toValue.length)
  for (let i = interpolated.length; i--;) {
    let from = i < fromValue.length ? fromValue[i] : 0
    interpolated[i] = from + (toValue[i] - from) * progress
  }
  return interpolated
}

// Animation definition for cycling colors
let animColors = c => ({strokeColor: c, fillColor: c})
const COLOR_ANIMATION = {
  0: animColors(0x3ba7db),
  25: animColors(0xdbbb47),
  50: animColors(0xff0000),
  75: animColors(0x66ff66),
  100: animColors(0x3ba7db),
  interpolate: {strokeColor: 'color', fillColor: 'color'},
  duration: 20000,
  iterations: Infinity
}




export default React.createClass({
  propTypes: {
    width: React.PropTypes.number,
    height: React.PropTypes.number
  },

  getInitialState() {
    return {
      valueCount: 100,
      values: null,
      strokeWidth: 3,
      strokeOpacity: 1,
      fillOpacity: 0.5,
      fillGradientPercent: 1,
      fillGradientFade: 3,
      randomStrategy: RAND_STRATEGIES[0]
    }
  },

  componentWillMount() {
    this._randomizeValues()
  },

  componentWillUnmount() {
    clearTimeout(this._timer)
  },

  _randomizeValues() {
    let valueCount = this.state.valueCount
    let values = new Float32Array(valueCount)

    if (this.state.randomStrategy === 'distance') {
      // Randomized distance from last
      values[0] = Math.random() * 10 + 5
      for (let i = 1; i < valueCount; i++) {
        do {
          values[i] = values[i - 1] + (Math.random() - 0.5) * 4
        } while (values[i] < 0)
      }
    } else {
      // Simple absolute value randomization:
      for (let i = valueCount; i--;) {
        values[i] = Math.random() * 10 + 5
      }
    }

    this.setState({values: values})
    this._timer = setTimeout(this._randomizeValues, 1000)
  },

  _onRandomStrategyChange(e) {
    this.setState({randomStrategy: RAND_STRATEGIES[e.target.selectedIndex]})
  },

  _onSliderChange(e) {
    this.setState({[e.target.name]: +e.target.value})
  },

  render() {
    let state = this.state
    let {width, height} = this.props

    return (
      <div>
        <Canvas3D
          antialias
          width={ width }
          height={ height }
          camera={ {
            class: OrthographicCamera,
            z: 1,
            top: height / 2,
            bottom: -height / 2,
            left: 0,
            right: width
          } }
          objects={ {
            key: 'curve',
            class: Curve,
            width: width,
            height: height * .4,
            y: -height * .2,

            values: state.values,

            strokeWidth: state.strokeWidth,
            strokeOpacity: state.strokeOpacity,
            fillOpacity: state.fillOpacity,
            fillGradientPercent: state.fillGradientPercent,
            fillGradientFade: state.fillGradientFade,

            transition: {
              values: {
                duration: 1000,
                easing: 'easeInOutCubic',
                interpolate: interpolateArray
              }
            },
            animation: COLOR_ANIMATION
          } }
        />

        <div className="example_desc">
          <p>Demonstrates transitioning a complex curve by using a custom interpolator for an array of values. Rendering uses a <a href="https://github.com/mattdesl/three-line-2d">three-line-2d</a> geometry with custom shaders for the stroke and gradient fill.</p>
        </div>

        <div className="example_controls">
          <div>
            <select onChange={ this._onRandomStrategyChange }>
              { RAND_STRATEGIES.map(name => (
                <option value={ name } selected={ name === this.state.randomStrategy }>Randomize: { name }</option>
              ))}
            </select>
          </div>
          <div>
            Value count: <input type="range" name="valueCount" onChange={ this._onSliderChange } value={ state.valueCount } min="10" max="500" /> { state.valueCount }
          </div>
          <div>
            Stroke width: <input type="range" name="strokeWidth" onChange={ this._onSliderChange } value={ state.strokeWidth } min="0" max="20" /> { state.strokeWidth }
          </div>
          <div>
            Stroke opacity: <input type="range" name="strokeOpacity" onChange={ this._onSliderChange } value={ state.strokeOpacity } min="0" max="1" step="0.1" /> { state.strokeOpacity }
          </div>
          <div>
            Fill opacity: <input type="range" name="fillOpacity" onChange={ this._onSliderChange } value={ state.fillOpacity } min="0" max="1" step="0.1" /> { state.fillOpacity }
          </div>
          <div>
            Fill gradient %: <input type="range" name="fillGradientPercent" onChange={ this._onSliderChange } value={ state.fillGradientPercent } min="0" max="1" step="0.1" /> { state.fillGradientPercent }
          </div>
          <div>
            Fill gradient fade: <input type="range" name="fillGradientFade" onChange={ this._onSliderChange } value={ state.fillGradientFade } min="1" max="10" step="1" /> { state.fillGradientFade }
          </div>
        </div>
      </div>
    )
  }
})

