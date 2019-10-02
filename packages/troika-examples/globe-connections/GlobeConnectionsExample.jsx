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
      stickToHand: true
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
              hand: 'left',
              weight: state.stickToHand ? 1 : 0,
              transition: {
                weight: {duration: 500, easing: 'easeOutExpo'}
              },
              x: -0.15,
              y: -0.1,
              z: -0.5,
              children: {
                key: 'globe',
                facade: Globe,
                ref: this._onFacadeRef.bind(this, 'globe'),
                scale: 0.075,
                y: 0.1,
                animation: {
                  from: {rotateY: -Math.PI},
                  to: {rotateY: Math.PI},
                  duration: 24000,
                  iterations: Infinity
                },
                // onMouseDown: e => {
                //   this.setState({stickToHand: true})
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
              flexDirection: 'column',
              children: [
                {
                  facade: UIBlock3DFacade,
                  padding: [0.005, 0.01],
                  backgroundColor: 0x333333,
                  borderRadius: [0.005, 0.005, 0, 0],
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  children: ['City', 'Population']
                },
                {
                  facade: UIBlock3DFacade,
                  flex: 1,
                  overflow: 'scroll',
                  flexDirection: 'column',
                  backgroundColor: 0x444444,
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
                props.vr ? {
                  facade: UIBlock3DFacade,
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  padding: 0.005,
                  children: [
                    {
                      facade: UIBlock3DFacade,
                      onClick: e => this.setState({stickToHand: !state.stickToHand}),
                      text: 'Attach to hand',
                      padding: 0.005,
                      backgroundColor: state.stickToHand ? 0x333399 : null,
                      borderColor: state.stickToHand ? null : 0x666666,
                      borderWidth: 0.002,
                      color: state.stickToHand ? 0xffffff : 0x999999,
                      borderRadius: 0.005
                    }
                  ]
                } : null
              ]
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

