import React from 'react'
import T from 'prop-types'
import {Canvas3D, Group3DFacade, ListFacade, PerspectiveCamera3DFacade} from '../../src/index'
import {InstanceableSphere, NonInstanceableSphere} from './Sphere'
import {Color} from 'three'

const ORIGIN = {x:0, y:0, z:0}
const BOX_SIZE = 1000
const tempColor = new Color()

class OrbitingCamera extends PerspectiveCamera3DFacade {
  constructor(parent) {
    super(parent)
    this.lookAt = ORIGIN
  }

  afterUpdate() {
    let {azimuth=0, inclination=0, radius=1} = this
    this.x = Math.cos(azimuth) * Math.sin(inclination) * radius
    this.y = Math.cos(inclination) * radius
    this.z = Math.sin(azimuth) * Math.sin(inclination) * radius
    super.afterUpdate()
  }
}


class InstanceableExample extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      useInstancing: true,
      animateRadius: false,
      animateColor: false,
      objectCount: 50000,
      data: []
    }
    this._generateData = this._generateData.bind(this)
    this._onSliderChange = this._onSliderChange.bind(this)
    this._onInstancingToggle = this._onInstancingToggle.bind(this)
    this._onAnimateRadiusToggle = this._onAnimateRadiusToggle.bind(this)
    this._onAnimateColorToggle = this._onAnimateColorToggle.bind(this)
    this._onSphereOver = this._onSphereOver.bind(this)
    this._onSphereOut = this._onSphereOut.bind(this)
  }

  componentWillMount() {
    this._generateData()
  }

  _generateData() {
    let data = new Array(this.state.objectCount)
    let color = new Color()
    for (let i = data.length; i--;) {
      let x = Math.random() * BOX_SIZE
      let y = Math.random() * BOX_SIZE
      let z = Math.random() * BOX_SIZE
      data[i] = {
        id: `sphere${i}`,
        x, y, z,
        color: color.setHSL((x + y + z) / BOX_SIZE / 3, 1, 0.5).getHex()
      }
    }
    this.setState({data})
  }

  _onSliderChange(e) {
    this.setState({[e.target.name]: +e.target.value})
  }

  _onInstancingToggle(e) {
    this.setState({useInstancing: !this.state.useInstancing})
  }

  _onAnimateRadiusToggle(e) {
    this.setState({animateRadius: !this.state.animateRadius})
  }

  _onAnimateColorToggle(e) {
    this.setState({animateColor: !this.state.animateColor})
  }

  _onSphereOver(e) {
    this.setState({hoveredId: e.target.id})
    cancelAnimationFrame(this._unhoverTimer)
  }

  _onSphereOut(e) {
    this._unhoverTimer = requestAnimationFrame(() => {
      this.setState({hoveredId: null})
    })
  }

  render() {
    let state = this.state
    let {width, height} = this.props

    let anim = {
      from: {radius: 3, color: 0x666666},
      to: {radius: 20, color: 0xcccccc},
      duration: 500,
      iterations: Infinity,
      direction: 'alternate'
    }

    return (
      <div>
        <Canvas3D
          antialias
          width={ width }
          height={ height }
          lights={ [
            { type: 'ambient', color: 0x666666 },
            { type: 'directional', color: 0xffffff, x: 1, y: 1, z: 1 },
            { type: 'directional', color: 0xffffff, x: -1, y: -1, z: -1 }
          ] }
          camera={ {
            facade: OrbitingCamera,
            far: 10000,
            radius: 2000,
            azimuth: 0, inclination: 0,
            animation: [{
              from: {azimuth: 0},
              to: {azimuth: Math.PI * 2},
              duration: 20000,
              iterations: Infinity,
              paused: !!state.hoveredId
            }, {
              from: {inclination: 0},
              to: {inclination: Math.PI / 1.1},
              direction: 'alternate',
              easing: 'easeInOutSine',
              duration: 8000,
              iterations: Infinity,
              paused: !!state.hoveredId
            }]
          } }
          objects={ {
            key: 'main',
            facade: Group3DFacade,
            x: BOX_SIZE / -2,
            y: BOX_SIZE / -2,
            z: BOX_SIZE / -2,
            children: {
              key: 'items',
              facade: ListFacade,
              data: state.data,
              template: {
                key: (d) => d.id,
                facade: state.useInstancing ? InstanceableSphere : NonInstanceableSphere,
                id: (d) => d.id,
                color: d => d.id === state.hoveredId ? 0xffffff : d.color,
                x: d => d.x,
                y: d => d.y,
                z: d => d.z,
                radius: d => d.id === state.hoveredId ? 10 : 6,
                onMouseOver: () => this._onSphereOver,
                onMouseOut: () => this._onSphereOut,
                animation: state.animateRadius || state.animateColor ? ((d, i) => {
                  if (i % 4) {
                    return null
                  }
                  let from = {}
                  let to = {}
                  if (state.animateRadius) {
                    from.radius = 2
                    to.radius = 30
                  }
                  if (state.animateColor) {
                    from.color = d.color
                    to.color = tempColor.set(d.color).offsetHSL(0.5, 0, 0).getHex()
                  }
                  return {
                    from,
                    to,
                    interpolate: {color: 'color'},
                    duration: 1000,
                    iterations: Infinity,
                    direction: 'alternate',
                    delay: (d.x + d.y + d.z) / BOX_SIZE / 3 * -3000
                  }
                }) : null
              }
            }
          } }
        />

        <div className="example_desc">
          <p>Demonstrates the usage of Instanceable3DFacade for fast rendering of thousands of similar objects.</p>
        </div>

        <div className="example_controls">
          <div>
            Number of objects: <input
              type="range"
              name="objectCount"
              onChange={ this._onSliderChange }
              value={ state.objectCount }
              min="100"
              max="100000"
            /> { state.objectCount } {
              state.objectCount !== state.data.length ? (
                <button onClick={ this._generateData } >Regenerate</button>
              ) : null
            }
          </div>
          <div>
            Use instancing: <input type="checkbox" checked={ state.useInstancing } onChange={ this._onInstancingToggle } />
          </div>
          <div>
            Animate Sizes: <input type="checkbox" checked={ state.animateRadius } onChange={ this._onAnimateRadiusToggle } />
          </div>
          <div>
            Animate Colors: <input type="checkbox" checked={ state.animateColor } onChange={ this._onAnimateColorToggle } />
          </div>
        </div>
      </div>
    )
  }
}

InstanceableExample.propTypes = {
  width: T.number,
  height: T.number
}

export default InstanceableExample
