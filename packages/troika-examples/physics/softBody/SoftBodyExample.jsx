import React from 'react'
import { Canvas3D, Group3DFacade } from 'troika-3d'
import { PhysicsManager } from 'troika-physics'
import DatGui, { DatBoolean, DatButton, DatNumber } from 'react-dat-gui'
import PhysicsGround from '../_shared/facades/PhysicsGround'
import PhysicsSphere from '../_shared/facades/PhysicsSphere'
import PhysicsSphereInstanceable from '../_shared/facades/PhysicsSphereInstanceable'
import PhysicsCube from '../_shared/facades/PhysicsCube'
import PhysicsCubeInstanceable from '../_shared/facades/PhysicsCubeInstanceable'

export default class SoftBodyExample extends React.Component {
  constructor (props) {
    super(props)

    this._getInitialState = this._getInitialState.bind(this)
    this._getThings = this._getThings.bind(this)
    this.handleClear = this.handleClear.bind(this)
    this.handleAddThings = this.handleAddThings.bind(this)

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
        isCube: Math.random() > 0.5,
        id: `thing_${idBase}_${i}`,
        radius: Math.max(0.01, Math.random()),
        x: -2 + (Math.random() * 2),
        y: (6 + (i * 2)),
        z: -2 + (Math.random() * 2),
        rotateX: Math.random() * 2 * Math.PI,
        rotateY: Math.random() * 2 * Math.PI,
        rotateZ: Math.random() * 2 * Math.PI,
        mass: Math.round(1 + (Math.random() * 10)),
        friction: Math.max(0.1, Math.random()),
        restitution: Math.max(0.1, Math.random()),
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
        numToAdd: 5,
        spherePressure: 150,
        cubePressure: 500,
        softSphere: true,
        softCube: false
      },
      things: this._getThings(5)
    }
  }

  handleAddThings () {
    this.setState({
      things: this.state.things.concat(this._getThings(this.state.config.numToAdd))
    })
  }

  handleClear () {
    this.setState({
      things: []
    })
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
          lights={[
            { type: 'ambient', color: 0x666666 },
            {
              type: 'point',
              color: 0xffffff,
              castShadow: true,
              x: 30,
              y: 50,
              z: 50
            }
          ]}
          camera={{
            x: 0,
            z: 25,
            y: 25,
            lookAt: { x: 0, y: 5, z: 0 },
            animation: [
              {
                0: { y: 20 },
                100: { y: 5 },
                duration: 20000,
                easing: 'easeInOutSine',
                iterations: Infinity,
                direction: 'alternate'
              }
            ]
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
                      key: 'ground',
                      facade: PhysicsGround,
                      x: 0,
                      y: 0,
                      z: 0,
                      opacity: 0.8,
                      color: 0xCCCCCC,
                      castShadow: true,
                      receiveShadow: true,
                      physics: {
                        isStatic: true,
                        restitution: 0.5
                      }
                    },
                    config.softSphere && {
                      key: 'softSphere',
                      facade: PhysicsSphere,
                      x: 0,
                      y: 3,
                      z: 0,
                      radius: 1.5,
                      color: 0xAAAAAA,
                      physics: {
                        isSoftBody: true,
                        pressure: config.spherePressure, // kPa?
                        // friction: 0.9,
                        mass: 15
                      },
                      castShadow: true,
                      receiveShadow: true
                    },
                    config.softCube && {
                      key: 'softCube',
                      facade: PhysicsCube,
                      x: 0,
                      y: 10,
                      z: 0,
                      radius: 5,
                      color: 0xDDDDDD,
                      physics: {
                        isSoftBody: true,
                        pressure: config.cubePressure, // kPa?
                        // friction: 0.9,
                        mass: 15
                      },
                      castShadow: true,
                      receiveShadow: true
                    },
                    ...state.things.map((thing, i) => {
                      const _facade = thing.isCube ? PhysicsCubeInstanceable : PhysicsSphereInstanceable

                      return {
                        key: thing.id,
                        facade: _facade,
                        id: thing.id,
                        x: thing.x,
                        y: thing.y,
                        z: thing.z,
                        rotateX: thing.rotateX,
                        rotateY: thing.rotateY,
                        rotateZ: thing.rotateZ,
                        radius: thing.radius,
                        color: thing.color,
                        opacity: 1,

                        physics: {
                          mass: thing.mass,
                          friction: thing.friction,
                          rollingFriction: thing.friction,
                          restitution: thing.isSoftBody ? 0 : thing.restitution
                        },

                        pointerEvents: true,
                        onMouseOver: this._onThingMouseOver,
                        onMouseOut: this._onThingMouseOut,
                        onMouseUp: this._onThingMouseUp,

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

          <DatBoolean path='softSphere' label='Soft Sphere' />
          <DatBoolean path='softCube' label='Soft Cube' />

          <DatNumber path='spherePressure' label='Sphere Pressure' min={1} max={1000} step={1} />
          <DatNumber path='cubePressure' label='Cube Pressure' min={1} max={1000} step={1} />

          <DatNumber path='numToAdd' label='Spawn Count' min={1} max={1000} step={1} />
          <DatButton onClick={this.handleAddThings} label='Spawn Objects' />
          <DatButton onClick={this.handleClear} label='Clear Objects' />
        </DatGui>

        <div className='example_desc dark'>
          <p>
            Demonstration of soft body physics and collisions with rigid bodies.
            Dynamic Objects: {state.things.length.toLocaleString()}
          </p>
        </div>
      </div>
    )
  }
}
