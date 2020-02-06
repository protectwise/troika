import React from 'react'
import { Canvas3D, Group3DFacade } from 'troika-3d'
import { CubeTextureLoader } from 'three'
import { PhysicsManager } from 'troika-physics'
import DatGui, { DatBoolean, DatButton, DatNumber } from 'react-dat-gui'
import Ground from '../_shared/facades/Ground'
import PhysicsSphereInstanceable from '../_shared/facades/PhysicsSphereInstanceable'
import PhysicsCubeInstanceable from '../_shared/facades/PhysicsCubeInstanceable'
import PhysicsGround from '../_shared/facades/PhysicsGround'
import CollisionDecal from './CollisionDecal'

const MIN_FORCE = 2
const MAX_DECALS = 40

const scale = function (opts) {
  const istart = opts.domain[0]
  const istop = opts.domain[1]
  const ostart = opts.range[0]
  const ostop = opts.range[1]

  return function scale (value) {
    return ostart + (ostop - ostart) * ((value - istart) / (istop - istart))
  }
}

const forceScale = scale({
  domain: [0, 2000],
  range: [1, 5]
})

const cubeMapDir = 'physics/_shared/textures/envMap/Yokohama/'
const backgroundTexture = new CubeTextureLoader().load([
  `${cubeMapDir}/posx.jpg`,
  `${cubeMapDir}/negx.jpg`,
  `${cubeMapDir}/posy.jpg`,
  `${cubeMapDir}/negy.jpg`,
  `${cubeMapDir}/posz.jpg`,
  `${cubeMapDir}/negz.jpg`
])

export default class CollisionEventExample extends React.Component {
  constructor (props) {
    super(props)

    this.collisionId = 1
    this._getInitialState = this._getInitialState.bind(this)
    this._getThings = this._getThings.bind(this)
    this.handleClear = this.handleClear.bind(this)
    this.handleSpawnThings = this.handleSpawnThings.bind(this)

    this.handleGroundCollision = this.handleGroundCollision.bind(this)

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
      groundColor: 0xFFFFFF,
      collisions: [],
      config: {
        physicsActive: true,
        debugPhysics: false,
        numToAdd: 20
      },
      things: this._getThings(5)
    }
  }

  handleSpawnThings () {
    this.setState({
      things: this.state.things.concat(this._getThings(this.state.config.numToAdd))
    })
  }

  handleClear () {
    this.setState({
      things: [],
      collisions: []
    })
  }

  handleGroundCollision (e) {
    if (!e.collisionTarget) {
      return
    }
    const collidedThingColor = e.collisionTarget.color
    const newState = {
      groundColor: collidedThingColor
    }
    if (e.collisionContacts) {
      const firstContact = e.collisionContacts[0]
      const scaledForce = forceScale(firstContact.force)
      if (scaledForce >= MIN_FORCE) {
        firstContact.id = this.collisionId++
        firstContact.scaledForce = scaledForce
        firstContact.color = collidedThingColor

        this.state.collisions.push(firstContact)
        newState.collisions = this.state.collisions
        newState.collisions.reverse()
        newState.collisions.length = MAX_DECALS // Max decals
        newState.collisions.reverse()
      }
    }
    this.setState(newState)
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
          background={backgroundTexture}
          camera={{
            x: 0,
            z: 25,
            y: 25,
            lookAt: { x: 0, y: 5, z: 0 },
            ref: this._onCameraRef,
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
              key: 'noPhysicsParent',
              facade: Ground,
              x: 0,
              y: 0,
              z: 0,
              color: state.groundColor,
              environmentMap: backgroundTexture,
              castShadow: false,
              receiveShadow: true,
              children: [
                {
                  key: 'physicsManager',
                  facade: PhysicsManager,
                  y: 0,
                  x: 0,
                  // gravity: {x: 0, y: DEFAULT_GRAVITY, z: 0},
                  simulationEnabled: config.physicsActive,
                  debug: config.debugPhysics,
                  children: [
                    {
                      key: 'system',
                      facade: Group3DFacade,
                      // rotateX: ORBITAL_PLANE_ROTATEX,
                      children: [
                        {
                          key: 'ground',
                          facade: PhysicsGround,
                          x: 0,
                          y: 0,
                          z: 0,
                          opacity: 1,
                          color: 0xFFFFFF,
                          castShadow: true,
                          receiveShadow: true,
                          physics: {
                            restitution: 0.5, // Slightly bouncy glass
                            isStatic: true
                          },
                          environmentMap: backgroundTexture,
                          onCollision: this.handleGroundCollision,
                          children: state.collisions.map((collision, i) => ({
                            key: collision.id,
                            facade: CollisionDecal,
                            y: 0,
                            collision: collision,
                            color: collision.color,
                            receiveShadow: true,
                            environmentMap: backgroundTexture
                          }))
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
                              friction: thing.friction, // 0.5,
                              rollingFriction: thing.friction,
                              restitution: thing.isSoftBody ? 0 : thing.restitution
                            },

                            castShadow: true,
                            receiveShadow: true
                          }
                        })

                      ]
                    }
                  ]
                }
              ]
            }
          ]}
        />

        <DatGui data={state.config} onUpdate={this.handleConfigUpdate}>
          <DatBoolean path='physicsActive' label='Physics Running' />
          <DatBoolean path='debugPhysics' label='Debug Colliders' />

          <DatNumber path='numToAdd' label='Number of objects to spawn' min={1} max={1000} step={1} />
          <DatButton onClick={this.handleSpawnThings} label='Spawn objects' />
          <DatButton onClick={this.handleClear} label='Clear objects' />
        </DatGui>

        <div className='example_desc'>
          <p>
            Demonstration of the <code>onCollision</code> event exposed by <code>troika-physics</code>. Collision events carry information about each participant Facade pair.
            Dynamic Objects: {state.things.length.toLocaleString()} <br />
            Collisions: {state.collisions.length.toLocaleString()}
          </p>
          <small>Cubemap image credits: http://www.humus.name/index.php</small>
        </div>
      </div>
    )
  }
}
