import React from 'react'
import T from 'prop-types'
import { Canvas3D, OrthographicCamera3DFacade } from 'troika-3d'
import Curve from './Curve'
import { ExampleConfigurator } from '../_shared/ExampleConfigurator.js'

const RAND_STRATEGIES = ['absolute', 'distance']
const PATH_SHAPES = ['curve', 'step']
const GRADIENT_SCALES = ['per-value', 'max-value']

// Custom interpolator function for transitioning the values array
export function interpolateArray(fromValue, toValue, progress) {
  let interpolated = new Float32Array(toValue.length)
  for (let i = interpolated.length; i--; ) {
    let from = i < fromValue.length ? fromValue[i] : 0
    interpolated[i] = from + (toValue[i] - from) * progress
  }
  return interpolated
}

// Animation definition for cycling colors
let animColors = c => ({ strokeColor: c, fillColor: c })
const COLOR_ANIMATION = {
  0: animColors(0x3ba7db),
  25: animColors(0xdbbb47),
  50: animColors(0xff0000),
  75: animColors(0x66ff66),
  100: animColors(0x3ba7db),
  interpolate: { strokeColor: 'color', fillColor: 'color' },
  duration: 20000,
  iterations: Infinity
}

class CurveAnimExample extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      cameraType: 'Orthographic',
      valueCount: 100,
      values: null,
      strokeWidth: 3,
      strokeOpacity: 1,
      fillOpacity: 0.5,
      fillGradientPercent: 1,
      fillGradientExp: 3,
      pathShape: PATH_SHAPES[0],
      fillGradientScale: GRADIENT_SCALES[0],
      randomStrategy: RAND_STRATEGIES[0]
    }
    this._randomizeValues = this._randomizeValues.bind(this)
    this._onDropdownChange = this._onDropdownChange.bind(this)
    this._onSliderChange = this._onSliderChange.bind(this)
  }

  componentWillMount() {
    this._randomizeValues()
  }

  componentWillUnmount() {
    clearTimeout(this._timer)
  }

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
      for (let i = valueCount; i--; ) {
        values[i] = Math.random() * 10 + 5
      }
    }

    this.setState({ values: values })
    this._timer = setTimeout(this._randomizeValues, 1000)
  }

  _onDropdownChange(e) {
    this.setState({
      [e.target.name]: e.target.options[e.target.selectedIndex].value
    })
  }

  _onSliderChange(e) {
    this.setState({ [e.target.name]: +e.target.value })
  }

  render() {
    let state = this.state
    let { width, height } = this.props

    return (
      <div>
        <Canvas3D
          antialias
          stats={ this.props.stats }
          width={width}
          height={height}
          camera={state.cameraType === 'Orthographic' ? {
            facade: OrthographicCamera3DFacade,
            z: 1,
            top: height / 2,
            bottom: -height / 2,
            left: 0,
            right: width
          } : {
            z: 1500,
            far: 10000,
            lookAt: {x: width / 2, y: 0, z: 0},
            animation: [
              {
                from: {x: 0},
                to: {x: width},
                iterations: Infinity,
                direction: 'alternate',
                duration: 5000
              },
              {
                from: {y: height / 2},
                to: {y: -height / 2},
                iterations: Infinity,
                direction: 'alternate',
                duration: 4000
              },
            ]
          }}
          objects={[{
            key: 'curve',
            facade: Curve,
            width: width,
            height: height * 0.4,
            y: -height * 0.2,

            values: state.values,

            pathShape: state.pathShape,
            strokeWidth: state.strokeWidth,
            strokeOpacity: state.strokeOpacity,
            fillOpacity: state.fillOpacity,
            fillGradientPercent: state.fillGradientPercent,
            fillGradientExp: state.fillGradientExp,
            fillGradientScale: state.fillGradientScale,

            transition: {
              values: {
                duration: 1000,
                easing: 'easeInOutCubic',
                interpolate: interpolateArray
              }
            },
            animation: COLOR_ANIMATION
          },
          {
            key: 'config',
            isXR: !!this.props.vr,
            facade: ExampleConfigurator,
            data: state,
            onUpdate: this.setState.bind(this),
            items: [
              {type: 'select', path: 'cameraType', label: 'Camera', options: ['Orthographic', 'Perspective']},
              {type: 'select', path: 'randomStrategy', label: 'Randomize', options: RAND_STRATEGIES},
              {type: 'select', path: 'pathShape', label: 'Path Shape', options: PATH_SHAPES},
              {type: 'select', path: 'fillGradientScale', label: 'Gradient Scale', options: GRADIENT_SCALES},
              {type: 'number', path: 'valueCount', label: 'Value Count', min: 10, max: 50, step: 1},
              {type: 'number', path: 'strokeWidth', label: 'Stroke Width', min: 0, max: 20, step: 1},
              {type: 'number', path: 'strokeOpacity', label: 'Stroke Opacity', min: 0, max: 1, step: 0.1},
              {type: 'number', path: 'fillOpacity', label: 'Fill Opacity', min: 0, max: 1, step: 0.1},
              {type: 'number', path: 'fillGradientPercent', label: 'Gradient Height', min: 0, max: 1, step: 0.1},
              {type: 'number', path: 'fillGradientExp', label: 'Gradient Exponent', min: 0, max: 10, step: 1},
            ]
          }]}
        />

        <div className="example_desc">
          <p>
            Demonstrates transitioning a complex curve by using a custom
            interpolator for an array of values. Rendering uses a{' '}
            <a href="https://github.com/mattdesl/three-line-2d">
              three-line-2d
            </a>{' '}
            geometry with custom shaders for the stroke and gradient fill.
          </p>
        </div>

      </div>
    )
  }
}

CurveAnimExample.propTypes = {
  width: T.number,
  height: T.number
}

export default CurveAnimExample
