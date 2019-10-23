import React from 'react'
import { Canvas3D, Group3DFacade } from 'troika-3d'
import { PhysicsManager } from 'troika-physics'
import DatGui, { DatBoolean, DatButton, DatSelect, DatNumber } from 'react-dat-gui'
import PhysicsGround from '../_shared/facades/PhysicsGround'
import PhysicsSphere from '../_shared/facades/PhysicsSphere'
import PhysicsSphereInstanceable from '../_shared/facades/PhysicsSphereInstanceable'
import PhysicsCube from '../_shared/facades/PhysicsCube'
import PhysicsCubeInstanceable from '../_shared/facades/PhysicsCubeInstanceable'

function find (arr, testFn) {
  for (let i = 0, len = arr.length; i < len; i++) {
    if (testFn(arr[i])) {
      return arr[i]
    }
  }
  return null
}

export default class RigidBodyExample extends React.Component {
  constructor (props) {
    super(props)

    this._getInitialState = this._getInitialState.bind(this)
    this._getThings = this._getThings.bind(this)
    this.handleClear = this.handleClear.bind(this)
    this.handleAddThings = this.handleAddThings.bind(this)
    this._onThingMouseOver = this._onThingMouseOver.bind(this)
    this._onThingMouseOut = this._onThingMouseOut.bind(this)
    this._onThingMouseUp = this._onThingMouseUp.bind(this)

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
      hoveredThing: null,
      config: {
        physicsActive: true,
        useInstanced: 'Instanced',
        numToAdd: 5,
        tableRestitution: 0.5
      },
      things: this._getThings(25)
    }
  }

  handleAddThings () {
    this.setState({
      things: this.state.things.concat(this._getThings(this.state.config.numToAdd))
    })
  }

  handleClear () {
    this.setState({
      hoveredThing: null,
      things: []
    })
  }

  _onThingMouseOver (e) {
    this.setState({ hoveredThing: e.target.id })
  }

  _onThingMouseOut () {
    this.setState({ hoveredThing: null })
  }

  _onThingMouseUp (e) {
    const clickedThing = find(this.state.things, d => d.id === e.target.id)
    clickedThing.radius *= 1.5
    clickedThing.mass *= 10
    this.forceUpdate()
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
          continuousRender={config.physicsActive} // for PhysicsManager
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
                      opacity: 0.2 + config.tableRestitution * 0.8,
                      color: 0xCCCCCC,
                      castShadow: true,
                      receiveShadow: true,
                      physics: {
                        isStatic: true,
                        restitution: config.tableRestitution
                      }
                    },
                    ...state.things.map((thing, i) => {
                      const isHoveredThing = state.hoveredThing === thing.id
                      const _facade = config.useInstanced === 'Instanced' ? (
                        thing.isCube ? PhysicsCubeInstanceable : PhysicsSphereInstanceable
                      ) : (
                        thing.isCube ? PhysicsCube : PhysicsSphere
                      )

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
                        color: isHoveredThing ? 0x222222 : thing.color,
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
          <DatSelect path='useInstanced' label='Instanced Objects' options={['Instanced', 'Non-Instanced']} />

          <DatNumber path='tableRestitution' label='Table Bounciness' min={0} max={1} step={0.1} />

          <DatNumber path='numToAdd' label='Spawn Count' min={1} max={1000} step={1} />
          <DatButton onClick={this.handleAddThings} label='Spawn Objects' />
          <DatButton onClick={this.handleClear} label='Clear Objects' />
        </DatGui>

        <div className='example_desc dark'>
          <p>
            Demonstration of basic rigid body physics and seamless compatibility with `troika` events. Click on physical objects to enlarge them and multiply their mass dramatically.
            Dynamic Objects: {state.things.length.toLocaleString()}
          </p>
        </div>
      </div>
    )
  }
}
