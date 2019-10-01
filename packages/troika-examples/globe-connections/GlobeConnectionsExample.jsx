import React from 'react'
import T from 'prop-types'
import ReactDOM from 'react-dom'
import {Canvas3D, Group3DFacade, ListFacade} from 'troika-3d'
import {UIBlock3DFacade} from 'troika-3d-ui'
import Globe from './Globe'
import TrackedControllerAnchoredFacade from './TrackedControllerAnchoredFacade'
import ConnectionsFacade from './ConnectionsFacade'
import cities from './cities.json'


class GlobeConnectionsExample extends React.Component {
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

    this.refs = Object.create(null)
    this._onFacadeRef = this._onFacadeRef.bind(this)
  }

  _onFacadeRef(name, facade) {
    this.refs[name] = facade
  }

  render() {
    let {props, state} = this
    let {width, height} = props
    return (
      <div onMouseMove={ this._onMouseMove }>
        <Canvas3D
          antialias
          stats={ this.props.stats }
          width={ width }
          height={ height }
          lights={ [
            {
              type: 'ambient'
            },
            {
              type: 'directional',
              x: 0,
              y: 0,
              z: 1
            }
          ] }
          objects={ [
            {
              facade: TrackedControllerAnchoredFacade,
              children: {
                key: 'globe',
                facade: Globe,
                ref: this._onFacadeRef.bind(this, 'globe'),
                scale: 0.075,
                x: props.vr ? 0 : -0.15,
                y: props.vr ? 0.1 : 0,
                z: props.vr ? 0 : -0.5,
                animation: {
                  from: {rotateY: -Math.PI},
                  to: {rotateY: Math.PI},
                  duration: 24000,
                  iterations: Infinity
                },
                // transition: {
                //   scaleY: true
                // }
              }
            },
            {
              facade: UIBlock3DFacade,
              x: 0.3,
              y: props.vr ? 0 : 0.1,
              z: props.vr ? -0.5 : -0.9,
              rotateY: Math.PI / -16,
              width: 0.25,
              height: 0.3,
              fontSize: 0.012,
              overflow: 'scroll',
              flexDirection: 'column',
              backgroundColor: 0x444444,
              borderRadius: 0.005,
              children: {
                key: 'cities',
                ref: this._onFacadeRef.bind(this, 'cities'),
                facade: ListFacade,
                data: cities,
                template: {
                  key: (d, i) => i,
                  facade: UIBlock3DFacade,
                  lat: d => d.lat,
                  lng: d => d.lng,
                  padding: [0.005, 0.01],
                  hovering: false,
                  backgroundColor: null,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  pointerStates: {
                    hover: {
                      hovering: true,
                      backgroundColor: 0x444499
                    }
                  },
                  children: d => [d.city_ascii + ', ' + d.country, d.population.toLocaleString()],
                }
              }
            },
            {
              facade: ConnectionsFacade,
              globe: this.refs.globe,
              cities: this.refs.cities
            }
          ] }
        />

        <div className="example_desc">
          <p>This uses <a href="#bezier3d">3D bezier curves</a> to visually connect a list of cities to their
          corresponding coordinates on a globe. Additionally, when in VR mode, the globe sticks to the position
          of one of the hand controllers.</p>
        </div>

      </div>
    )
  }
}

GlobeConnectionsExample.propTypes = {
  width: T.number,
  height: T.number
}

export default GlobeConnectionsExample

