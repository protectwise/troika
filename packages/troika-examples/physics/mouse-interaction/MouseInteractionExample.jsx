import React from 'react'
import { Plane, Vector3, Matrix4 } from 'three'
import { Canvas3D, Group3DFacade } from 'troika-3d'
import { PhysicsManager } from 'troika-physics'
import DatGui, { DatBoolean, DatButton, DatNumber } from 'react-dat-gui'
import PhysicsGround from '../_shared/facades/PhysicsGround'
import Puck from './Puck'
import Paddle from './Paddle'
import AirHockeyTable from './AirHockeyTable'

function find (arr, testFn) {
  for (let i = 0, len = arr.length; i < len; i++) {
    if (testFn(arr[i])) {
      return arr[i]
    }
  }
  return null
}

const TRANS = {
  duration: 700,
  easing: 'easeOutExpo'
}

export default class KinematicsExample extends React.Component {
  constructor (props) {
    super(props)

    this._getInitialState = this._getInitialState.bind(this)
    this._getThings = this._getThings.bind(this)
    this.handleClear = this.handleClear.bind(this)
    this.handleSpawnObjects = this.handleSpawnObjects.bind(this)

    this._onPlanetMouseOver = this._onPlanetMouseOver.bind(this)
    this._onPlanetMouseOut = this._onPlanetMouseOut.bind(this)
    this._onPlanetDragStart = this._onPlanetDragStart.bind(this)
    this._onPlanetDrag = this._onPlanetDrag.bind(this)
    this._onPlanetDragEnd = this._onPlanetDragEnd.bind(this)
    // this._onPlanetDragEnter = this._onPlanetDragEnter.bind(this)
    // this._onPlanetDragLeave = this._onPlanetDragLeave.bind(this)

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
      dragX: -5,
      dragZ: -5
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

  _onPlanetMouseOver (e) {
    this.setState({ hoveredPlanet: e.target.id })
  }

  _onPlanetMouseOut () {
    this.setState({ hoveredPlanet: null })
  }

  _onPlanetDragStart (e) {
    this.setState({ draggedPlanet: e.target.id })
  }

  _onPlanetDrag (e) {
    // Determine event's point on the orbital plane
    // let systemTransformMatrix = new Matrix4().makeRotationX(ORBITAL_PLANE_ROTATEX)
    const systemPlane = new Plane().setComponents(0, 1, 0, 0)// .applyMatrix4(systemTransformMatrix)
    const ray = e.ray // all pointer events in a 3D world are guaranteed to have a `ray`
    const posVec3 = ray.intersectPlane(systemPlane, new Vector3())
    if (posVec3) {
      // Update paddle or puck position
      // let objData = find(this.state.planets, d => d.id === e.target.id)
      // let objData = this.getChildByKey('paddle')
      // objData.x = posVec3.x
      // objData.y = posVec3.y
      // objData.z = posVec3.z
      // planetData.initialAngle = posVec3.x === 0 ? 0 : Math.atan(posVec3.y / posVec3.x) + (posVec3.x < 0 ? Math.PI : 0)
      // planetData.distance = Math.sqrt(posVec3.x * posVec3.x + posVec3.y * posVec3.y)
      // this.forceUpdate()
      this.setState({
        dragX: posVec3.x,
        dragZ: posVec3.z
      })
    }
  }

  _onPlanetDragEnd (e) {
    this.setState({
      draggedPlanet: null
      // droppablePlanet: null
    })
  }

  // _onPlanetDragEnter(e) {
  //   this.setState({droppablePlanet: e.target.id})
  // }

  // _onPlanetDragLeave(e) {
  //   this.setState({droppablePlanet: null})
  // }

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
            x: 0,
            z: 25,
            y: 10,
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
                  key: 'system',
                  facade: Group3DFacade,
                  children: [
                    {
                      key: 'table',
                      facade: AirHockeyTable,
                      x: 0,
                      y: 0,
                      z: 0,
                      height: 2,
                      width: 10,
                      length: 30,
                      wallThickness: 0.2,
                      color: 0xFF0000,
                      physics: {
                        restitution: 0.01,
                        friction: config.tableFriction,
                        // mass: 999,
                        isStatic: true
                        // isKinematic: true
                      }
                    },
                    // {
                    //   key: 'ground',
                    //   facade: PhysicsGround,
                    //   x: 0,
                    //   y: -0.5,
                    //   z: 0,
                    //   scaleZ: 3,
                    //   opacity: 0.2,
                    //   color: 0xCCCCCC,
                    //   castShadow: true,
                    //   receiveShadow: true,
                    //   animation: [
                    //     // {
                    //     //   0: { 
                    //     //     // rotateZ: Math.PI / 6 
                    //     //     scaleZ: 1
                    //     //   },
                    //     //   100: { 
                    //     //     // rotateZ: -Math.PI / 6 
                    //     //     scaleZ: 5
                    //     //   },
                    //     //   duration: 10000,
                    //     //   iterations: Infinity,
                    //     //   direction: 'alternate'
                    //     // }
                    //   ],
                    //   physics: {
                    //     restitution: 0.01,
                    //     friction: config.tableFriction,
                    //     isStatic: true
                    //     // isKinematic: true
                    //   }
                    // },
                    {
                      key: 'paddle',
                      facade: Paddle,
                      x: state.dragX,
                      y: 1,
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
                      color: 0xCCCCCC,
                      opacity: 1,
                      physics: {
                        isKinematic: true,
                        friction: config.paddleFriction,
                        mass: config.paddleMass,
                        // restitution: 0.01
                      },
                      castShadow: true,
                      receiveShadow: true,

                      pointerEvents: true, //! isDraggedPlanet,

                      onMouseOver: this._onPlanetMouseOver,
                      onMouseOut: this._onPlanetMouseOut,

                      onDragStart: this._onPlanetDragStart,
                      onDrag: this._onPlanetDrag,
                      onDragEnd: this._onPlanetDragEnd,

                      // transition: {
                      //   x: TRANS,
                      //   y: TRANS,
                      //   z: TRANS
                      // }

                      // onDragEnter: !isDraggedPlanet && this._onPlanetDragEnter,
                      // onDragLeave: !isDraggedPlanet && this._onPlanetDragLeave,
                      // onDrop: !isDraggedPlanet && this._onPlanetDrop,
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
                          mass: config.puckMass, //thing.mass,
                          friction: config.puckFriction, //thing.friction,
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
