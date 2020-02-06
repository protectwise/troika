import React from 'react'
import { Canvas3D, Group3DFacade } from 'troika-3d'
import { PhysicsManager } from 'troika-physics'
import DatGui, { DatBoolean, DatButton, DatNumber } from 'react-dat-gui'
import PhysicsSphereInstanceable from '../_shared/facades/PhysicsSphereInstanceable'
import PhysicsCubeInstanceable from '../_shared/facades/PhysicsCubeInstanceable'
import PhysicsGround from '../_shared/facades/PhysicsGround'
import FanBlade from './FanBlade'

export default class KinematicsExample extends React.Component {
  constructor (props) {
    super(props)

    this._getInitialState = this._getInitialState.bind(this)
    this._getThings = this._getThings.bind(this)
    this.handleClear = this.handleClear.bind(this)
    this.handleSpawnObjects = this.handleSpawnObjects.bind(this)

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
        bladeSpinning: true,
        bladeHeight: 1,
        bladeSpeed: 0.3,
        numToAdd: 5
      },
      things: this._getThings(5)
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
              y: 30,
              z: 30
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
                      opacity: 1,
                      color: 0xCCCCCC,
                      castShadow: true,
                      receiveShadow: true,
                      physics: {
                        restitution: 0.5,
                        isStatic: true
                      }
                    },
                    {
                      key: 'kinematicsObject',
                      facade: FanBlade,
                      x: 0,
                      y: config.bladeHeight,
                      z: 0,
                      rotateZ: Math.PI / 4,
                      animation: [
                        {
                          paused: !config.bladeSpinning,
                          0: { rotateY: 0 },
                          100: { rotateY: Math.PI * 2 },
                          duration: 1000 / config.bladeSpeed,
                          iterations: Infinity
                        }
                      ],
                      color: 0x000000,
                      opacity: 1,
                      physics: {
                        isKinematic: true,
                        friction: 0.5,
                        restitution: 0.7
                      },
                      castShadow: true,
                      receiveShadow: true
                    },
                    ...state.things.map((thing, i) => {
                      const _facade = thing.isBox ? PhysicsCubeInstanceable : PhysicsSphereInstanceable

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
                          restitution: thing.restitution
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

          <DatNumber path='bladeHeight' label='Blade Height' min={0} max={5} step={0.5} />
          <DatNumber path='bladeSpeed' label='Blade Spin Rate' min={0.1} max={10} step={0.1} />
          <DatBoolean path='bladeSpinning' label='Blade Spin' />

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
