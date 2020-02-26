import React from 'react'
import { Plane, Vector3 } from 'three'
import { Canvas3D, Group3DFacade } from 'troika-3d'
import { PhysicsManager } from 'troika-physics'
import DatGui, { DatBoolean, DatButton, DatNumber } from 'react-dat-gui'
import Puck from './Puck'
import Paddle from './Paddle'
import { AirHockeyTable, TableSurface } from './AirHockeyTable'

const WIDTH = 20
const LENGTH = 42

export default class KinematicsExample extends React.Component {
  constructor (props) {
    super(props)

    this._getInitialState = this._getInitialState.bind(this)
    this._getThings = this._getThings.bind(this)
    this.handleClear = this.handleClear.bind(this)
    this.handleSpawnObjects = this.handleSpawnObjects.bind(this)

    this._onPaddleMouseOver = this._onPaddleMouseOver.bind(this)
    this._onPaddleMouseOut = this._onPaddleMouseOut.bind(this)
    this._onPaddleDragStart = this._onPaddleDragStart.bind(this)
    this._onPaddleDrag = this._onPaddleDrag.bind(this)
    this._onPaddleDragEnd = this._onPaddleDragEnd.bind(this)
    // this._onPaddleDragEnter = this._onPaddleDragEnter.bind(this)
    // this._onPaddleDragLeave = this._onPaddleDragLeave.bind(this)

    this.state = this._getInitialState()

    this.handleConfigUpdate = (newConfig) => {
      this.setState({ config: newConfig })
    }
  }

  _getThings (numThings) {
    const things = []
    const idBase = Date.now()
    for (let i = 0; i < numThings; i++) {
      things.push({
        isBox: Math.random() > 0.5,
        id: `thing_${idBase}_${i}`,
        radius: Math.max(0.01, Math.random()),
        x: -5 + (Math.random() * 10),
        y: 2 + (Math.random() * 2),
        z: -5 + (Math.random() * 10),
        mass: 4,
        friction: 0.5,
        restitution: 0.1,
        color: Math.round(Math.random() * 0xffffff)
      })
    }
    return things
  }

  _getInitialState () {
    return {
      config: {
        physicsActive: true,
        debugPhysics: false,
        // bladeSpinning: true,
        // bladeHeight: 1,
        tableFriction: 0.5,
        paddleFriction: 0.5,
        paddleMass: 8,
        puckFriction: 0.5,
        puckMass: 800,
        numToAdd: 5
      },
      things: this._getThings(3),
      dragX: 0,
      dragZ: 0
    }
  }

  handleSpawnObjects () {
    this.setState({
      things: this.state.things.concat(this._getThings(this.state.config.numToAdd))
    })
  }

  handleClear () {
    this.setState({
      things: []
    })
  }

  _onPaddleMouseOver (e) {
    this.setState({ hoveredPaddle: e.target.id })
  }

  _onPaddleMouseOut () {
    this.setState({ hoveredPaddle: null })
  }

  _onPaddleDragStart (e) {
    this.setState({ draggedPaddle: e.target.id })
  }

  _onPaddleDrag (e) {
    const tablePlane = new Plane().setComponents(0, 1, 0, 0)// .applyMatrix4(systemTransformMatrix)
    const ray = e.ray // all pointer events in a 3D world are guaranteed to have a `ray`
    const posVec3 = ray.intersectPlane(tablePlane, new Vector3())
    if (posVec3) {
      this.setState({
        dragX: posVec3.x,
        dragZ: posVec3.z
      })
    }
  }

  _onPaddleDragEnd (e) {
    this.setState({
      draggedPaddle: null
      // droppablePaddle: null
    })
  }

  _onPaddleDragEnter (e) {
    this.setState({ droppablePaddle: e.target.id })
  }

  _onPaddleDragLeave (e) {
    this.setState({ droppablePaddle: null })
  }

  render () {
    const state = this.state
    const { width, height } = this.props
    const { config } = state

    return (
      <div>
        <Canvas3D
          antialias
          stats={this.props.stats}
          width={width}
          shadows
          height={height}
          continuousRender={config.physicsActive}
          lights={[
            { type: 'ambient', color: 0x666666 },
            {
              type: 'point',
              color: 0xffffff,
              castShadow: true,
              x: 30,
              y: 30,
              z: 30
            }
          ]}
          camera={{
            x: 15,
            z: 35,
            y: 10,
            // lookAt: state.things.length > 0 ? state.things[0] : { x: 0, y: 0, z: 0 }
            lookAt: { x: 0, y: 0, z: 0 }
          }}
          objects={[
            {
              key: 'physicsManager',
              facade: PhysicsManager,
              y: 0,
              x: 0,
              simulationEnabled: config.physicsActive,
              debug: config.debugPhysics,
              children: [
                {
                  key: 'table-hockey',
                  facade: Group3DFacade,
                  children: [
                    {
                      key: 'tableSurface',
                      facade: TableSurface,
                      onDragStart: this._onPaddleDragStart,
                      onDrag: this._onPaddleDrag,
                      onDragEnd: this._onPaddleDragEnd,
                      pointerEvents: true,
                      x: 0,
                      y: 0.01,
                      z: 0,
                      scaleX: WIDTH,
                      scaleY: 0.1,
                      scaleZ: LENGTH,
                      physics: {
                        restitution: 0.001,
                        friction: config.tableFriction,
                        // mass: 999,
                        isStatic: true // Will produce a combined triangle mesh optimized for Static bodies
                        // isKinematic: true
                      }
                    },
                    {
                      key: 'table',
                      facade: AirHockeyTable,
                      x: 0,
                      y: 0,
                      z: 0,
                      height: 2,
                      width: WIDTH,
                      length: LENGTH,
                      wallThickness: 0.2,
                      color: 0xFF0000,
                      physics: {
                        restitution: 0.01,
                        friction: config.tableFriction,
                        // mass: 999,
                        isStatic: true // Will produce a combined triangle mesh optimized for Static bodies
                        // isKinematic: true
                      }
                    },
                    {
                      key: 'paddle',
                      facade: Paddle,
                      height: 1,
                      radius: 3,
                      x: state.dragX,
                      y: 0,
                      z: state.dragZ,
                      // animation: [
                      //   {
                      //     paused: !config.paddleDragged,
                      //     0: { x: -5, z: 5 },
                      //     100: { x: 5, z: -5 },
                      //     duration: 3000,
                      //     iterations: Infinity,
                      //     direction: 'alternate'
                      //   }
                      // ],
                      opacity: 1,
                      physics: {
                        isKinematic: true,
                        friction: config.paddleFriction,
                        mass: config.paddleMass
                        // restitution: 0.01
                      },
                      castShadow: true,
                      receiveShadow: true,

                      pointerEvents: true, //! isDraggedPaddle,

                      onMouseOver: this._onPaddleMouseOver,
                      onMouseOut: this._onPaddleMouseOut

                      // transition: {
                      //   x: TRANS,
                      //   y: TRANS,
                      //   z: TRANS
                      // }

                      // onDragEnter: !isDraggedPaddle && this._onPaddleDragEnter,
                      // onDragLeave: !isDraggedPaddle && this._onPaddleDragLeave,
                      // onDrop: !isDraggedPaddle && this._onPlanetDrop,
                    },
                    ...state.things.map((thing, i) => {
                      return {
                        key: thing.id,
                        facade: Puck,
                        id: thing.id,
                        x: thing.x,
                        y: thing.y,
                        z: thing.z,
                        radius: thing.radius,
                        color: thing.color,
                        opacity: 1,
                        physics: {
                          mass: config.puckMass, // thing.mass,
                          friction: config.puckFriction // thing.friction,
                          // restitution: 0.01 thing.restitution
                        },
                        castShadow: true,
                        receiveShadow: true
                      }
                    })

                  ]
                }
              ]
            }
          ]}
        />

        <DatGui data={state.config} onUpdate={this.handleConfigUpdate}>
          <DatBoolean path='physicsActive' label='Physics Running' />
          <DatBoolean path='debugPhysics' label='Debug Colliders' />

          <DatNumber path='tableFriction' label='Table air (friction)' min={0.01} max={10} step={0.01} />
          <DatNumber path='paddleFriction' label='Paddle friction' min={0.01} max={10} step={0.01} />
          <DatNumber path='puckFriction' label='Puck friction' min={0.01} max={10} step={0.01} />
          <DatNumber path='paddleMass' label='Paddle mass' min={1} max={9999} step={1} />
          <DatNumber path='puckMass' label='Puck mass' min={1} max={9999} step={1} />
          {/* <DatNumber path='bladeSpeed' label='Blade Spin Rate' min={0.1} max={10} step={0.1} />
          <DatBoolean path='bladeSpinning' label='Blade Spin' /> */}

          <DatNumber path='numToAdd' label='Number of objects to spawn' min={1} max={1000} step={1} />
          <DatButton onClick={this.handleSpawnObjects} label='Spawn objects' />
          <DatButton onClick={this.handleClear} label='Clear objects' />
        </DatGui>

        <div className='example_desc'>
          <p>
            Kinematic Objects are controlled by Troika, but still participate in collisions with Dynamic objects in the Physics World.
          </p>
        </div>
      </div>
    )
  }
}
