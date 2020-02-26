import React from 'react'
import T from 'prop-types'
import ReactDOM from 'react-dom'
import {Canvas3D} from 'troika-3d'
import Earth from './Earth'
import { ExampleConfigurator } from '../_shared/ExampleConfigurator.js'


class GlobeExample extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      rotateX: 0,
      rotateY: 0,
      trackMouse: false,
      hoveredCountry: null,
      wireframe: false,
      colorScheme: 'technicolor'
    }
    this._onMouseMove = this._onMouseMove.bind(this)
    this._onCountryMouseOver = this._onCountryMouseOver.bind(this)
    this._onCountryMouseOut = this._onCountryMouseOut.bind(this)
    this._getOceanColor = this._getOceanColor.bind(this)
    this._getOceanTexture = this._getOceanTexture.bind(this)
    this._getCountryColor = this._getCountryColor.bind(this)
    this._getCountryTexture = this._getCountryTexture.bind(this)
  }

  _onMouseMove(e) {
    if (this.state.trackMouse) {
      let rect = ReactDOM.findDOMNode(this).getBoundingClientRect()
      let x = e.clientX - rect.left
      let y = e.clientY - rect.top
      this.setState({
        rotateX: Math.PI / 2 * (y / rect.height * 2 - 1),
        rotateY: Math.PI * (x / rect.width * 2 - 1)
      })
    }
  }

  _onCountryMouseOver(id) {
    this.setState({hoveredCountry: id})
  }

  _onCountryMouseOut() {
    this.setState({hoveredCountry: null})
  }

  _getOceanColor() {
    switch (this.state.colorScheme) {
      case 'technicolor':
        return 0x000066
      case 'greyscale':
        return 0x000000
      case 'satellite':
        return 0x004989
      case 'night':
        return 0x000000
      case 'bluemarble':
        return 0xffffff
      case 'pumpkin':
        return 0x666666
    }
  }

  _getOceanTexture() {
    switch (this.state.colorScheme) {
      case 'bluemarble':
        return 'globe/texture_bluemarble.jpg'
      case 'pumpkin':
        return 'globe/texture_pumpkin.jpg'
    }
    return null
  }

  _getCountryColor(d, i, arr) {
    let hovering = d.id === this.state.hoveredCountry
    switch (this.state.colorScheme) {
      case 'technicolor':
        if (i % 2) i = arr.length - 1 - i //flip every other one for greater neighbor contrast
        let color = Math.round(i / (arr.length - 1) * 0xffffff)
        return hovering ? 0xffffff - color : color
      case 'greyscale':
        if (hovering) return 0x3ba7db //highlight blue
        if (i % 2) i = arr.length - 1 - i //flip every other one for greater neighbor contrast
        let grey = Math.round(50 + 100 * i / (arr.length - 1))
        return (grey << 16) + (grey << 8) + grey
      case 'satellite':
        return hovering ? 0x3ba7db : 0xffffff
      case 'night':
        return hovering ? 0x0000ff : 0xffffff
      case 'bluemarble':
        return hovering ? 0x999999 : 0xffffff
      case 'pumpkin':
        return hovering ? 0xffffff : 0xcccccc
    }
  }

  _getCountryTexture() {
    switch (this.state.colorScheme) {
      case 'satellite':
        return 'globe/texture_day.jpg'
      case 'night':
        return 'globe/texture_night.jpg'
      case 'bluemarble':
        return 'globe/texture_bluemarble.jpg'
      case 'pumpkin':
        return 'globe/texture_pumpkin.jpg'
    }
    return null
  }

  render() {
    let state = this.state
    let {width, height} = this.props
    return (
      <div onMouseMove={ this._onMouseMove }>
        <Canvas3D
          antialias
          stats={ this.props.stats }
          width={ width }
          height={ height }
          camera={ {
            aspect: width / height,
            x: 0,
            y: 0,
            z: 3,
            lookAt: {x: 0, y: 0, z: 0}
          } }
          lights={ [
            {
              type: 'directional',
              color: 0xffffff,
              x: 1,
              y: 0,
              z: 1
            }
          ] }
          objects={ [
            {
              key: 'earth',
              facade: Earth,
              scaleX: 1,
              scaleY: state.colorScheme === 'pumpkin' ? 0.7 : 1,
              scaleZ: 1,
              rotateY: state.trackMouse ? state.rotateY : 0,
              rotateX: state.trackMouse ? state.rotateX : 0,
              onCountryMouseOver: this._onCountryMouseOver,
              onCountryMouseOut: this._onCountryMouseOut,
              //highlightCountry: state.hoveredCountry,
              wireframe: state.wireframe,
              oceanColor: this._getOceanColor(),
              oceanTexture: this._getOceanTexture(),
              getCountryColor: this._getCountryColor,
              countryTexture: this._getCountryTexture(),
              animation: state.trackMouse ? null : {
                from: {rotateY: -Math.PI},
                to: {rotateY: Math.PI},
                duration: 24000,
                iterations: Infinity
              },
              transition: {
                scaleY: true
              }
            },
            {
              key: 'config',
              isXR: !!this.props.vr,
              facade: ExampleConfigurator,
              data: state,
              onUpdate: this.setState.bind(this),
              items: [
                {type: 'boolean', path: 'trackMouse', label: 'Track Mouse'},
                {type: 'boolean', path: 'wireframe', label: 'Wireframe'},
                {type: 'select', path: 'colorScheme', label: 'Color Scheme', options: [
                  {value: 'technicolor', label: 'Technicolor'},
                  {value: 'greyscale', label: 'Greyscale'},
                  {value: 'satellite', label: 'Satellite'},
                  {value: 'bluemarble', label: 'Blue Marble'},
                  {value: 'night', label: 'Night Lights'},
                  {value: 'pumpkin', label: 'Pumpkin'}
                ]}
              ]
            }
          ] }
        />

        <div className="example_desc">
          <p></p>
        </div>
      </div>
    )
  }
}

GlobeExample.propTypes = {
  width: T.number,
  height: T.number
}

export default GlobeExample

