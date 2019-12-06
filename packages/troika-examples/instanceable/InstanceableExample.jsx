import React from 'react'
import T from 'prop-types'
import {ListFacade} from 'troika-core'
import {Canvas3D, Group3DFacade, PerspectiveCamera3DFacade} from 'troika-3d'
import NonInstanceableSphere from './NonInstanceableSphere'
import InstanceableSphere from './InstanceableSphere'
import InstanceableSphereNoMatrix from './InstanceableSphereNoMatrix'
import {Color} from 'three'

const ORIGIN = {x:0, y:0, z:0}
const BOX_SIZE = 1
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
      radiusMethod: 'uniform',
      animateRadius: true,
      animateColor: true,
      objectCount: 2500,
      data: []
    }
    this._generateData = this._generateData.bind(this)
    this._onSliderChange = this._onSliderChange.bind(this)
    this._onDropdownChange = this._onDropdownChange.bind(this)
    this._onCheckboxToggle = this._onCheckboxToggle.bind(this)
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

  _onDropdownChange(e) {
    this.setState({[e.target.name]: e.target.value})
  }

  _onCheckboxToggle(e) {
    this.setState({[e.target.name]: !this.state[e.target.name]})
  }

  _onSphereOver(e) {
    this.setState({hoveredId: e.target.id})
    clearTimeout(this._unhoverTimer)
  }

  _onSphereOut(e) {
    clearTimeout(this._unhoverTimer)
    this._unhoverTimer = setTimeout(() => {
      this.setState({hoveredId: null})
    }, 500)
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
            { type: 'ambient', color: 0x666666 },
            { type: 'directional', color: 0xffffff, x: 1, y: 1, z: 1 },
            { type: 'directional', color: 0xffffff, x: -1, y: -1, z: -1 }
          ] }
          camera={ {
            facade: OrbitingCamera,
            radius: BOX_SIZE * 1.5,
            fov: 70,
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
                facade: state.useInstancing ? (
                  state.radiusMethod === 'uniform' ? InstanceableSphereNoMatrix : InstanceableSphere
                ) : NonInstanceableSphere,
                id: (d) => d.id,
                color: d => d.color,
                hovered: d => d.id === state.hoveredId,
                x: d => d.x,
                y: d => d.y,
                z: d => d.z,
                radius: BOX_SIZE * 0.006,
                onMouseOver: () => this._onSphereOver,
                onMouseOut: () => this._onSphereOut,
                animation: state.animateRadius || state.animateColor ? ((d, i) => {
                  if (i % 4) {
                    return null
                  }
                  let from = {}
                  let to = {}
                  if (state.animateRadius) {
                    from.radius = BOX_SIZE * 0.002
                    to.radius = BOX_SIZE * 0.03
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
                    delay: (d.x + d.y + d.z) / BOX_SIZE / 3 * -3000,
                    paused: !!state.hoveredId
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
            Use instancing: <input type="checkbox" checked={ state.useInstancing } name="useInstancing" onChange={ this._onCheckboxToggle } />
          </div>
          { state.useInstancing ? (
            <div>
              Radius set via: <select name="radiusMethod" onChange={ this._onDropdownChange }>
                <option value="uniform">Custom shader uniform</option>
                <option value="matrix">Scaled transform matrix</option>
              </select>
            </div>
          ) : null }
          <div>
            Animate Sizes: <input type="checkbox" checked={ state.animateRadius } name="animateRadius" onChange={ this._onCheckboxToggle } />
          </div>
          <div>
            Animate Colors: <input type="checkbox" checked={ state.animateColor } name="animateColor" onChange={ this._onCheckboxToggle } />
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
