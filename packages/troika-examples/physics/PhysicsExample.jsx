import React from 'react'
import T from 'prop-types'
import {Canvas3D, Group3DFacade} from 'troika-3d'
import {Plane, Vector3, Matrix4, CubeTextureLoader} from 'three'
import {PhysicsManager, CONSTRAINTS} from 'troika-physics'
import DatGui, {DatBoolean, DatButton, DatSelect, DatNumber} from 'react-dat-gui'
import Ground from './Ground'
import PhysicsSphereInstanceable from './PhysicsSphereInstanceable'
import PhysicsCubeInstanceable from './PhysicsCubeInstanceable'
import PhysicsSphere from './PhysicsSphere'
import PhysicsCube from './PhysicsCube'
import PhysicsGround from './PhysicsGround'
import CollisionDecal from './CollisionDecal'
import FanBlade from './FanBlade'

const DEFAULT_GRAVITY = -9.8

function find(arr, testFn) {
  for (let i = 0, len = arr.length; i < len; i++) {
    if (testFn(arr[i])) {
      return arr[i]
    }
  }
  return null
}

var scale = function(opts){
  var istart = opts.domain[0],
      istop  = opts.domain[1],
      ostart = opts.range[0],
      ostop  = opts.range[1];

  return function scale(value) {
    return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
  }
};

const forceScale = scale({
  domain: [0, 2000],
  range: [1, 5]
})

const cubeMapDir = 'physics/textures/envMap/Yokohama/'
const backgroundTexture = new CubeTextureLoader().load([
  `${cubeMapDir}/posx.jpg`,
  `${cubeMapDir}/negx.jpg`,
  `${cubeMapDir}/posy.jpg`,
  `${cubeMapDir}/negy.jpg`,
  `${cubeMapDir}/posz.jpg`,
  `${cubeMapDir}/negz.jpg`,
])

class PhysicsExample extends React.Component {
  constructor(props) {
    super(props)

    this.collisionId = 1
    this._getInitialState = this._getInitialState.bind(this)
    this._getBalls = this._getBalls.bind(this)
    this._clear = this._clear.bind(this)
    this._spawnObjects = this._spawnObjects.bind(this)
    this._onCameraRef = this._onCameraRef.bind(this)
    this._onBallMouseOver = this._onBallMouseOver.bind(this)
    this._onBallMouseOut = this._onBallMouseOut.bind(this)
    this._onBallMouseUp = this._onBallMouseUp.bind(this)
    
    this._onBallDragStart = this._onBallDragStart.bind(this)
    this._onBallDrag = this._onBallDrag.bind(this)
    this._onBallDragEnd = this._onBallDragEnd.bind(this)

    this._onGroundCollision = this._onGroundCollision.bind(this)

    this.state = this._getInitialState()

    this._onConfigUpdate = (newConfig) => {
      this.setState({config: newConfig})
    }
  }

  _getBalls(numBalls) {
    let balls = []
    const idBase = Date.now()
    for (let i = 0; i < numBalls; i++) {
      balls.push({
        isBox: Math.random() > 0.5,
        id: `ball_${idBase}_${i}`,
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
        // physicsDisabled: i === 1,
        color: Math.round(Math.random() * 0xffffff),
      })
    }
    return balls
  }

  _getInitialState() {
    return {
      groundColor: 0xFFFFFF,
      collisions: [],
      hoveredBall: null,
      config: {
        useInstanced: "Instanced",
        physicsActive: false,
        bladeSpinning: false,
        bladeHeight: 0.5,
        bladeSpeed: 5,
        numToAdd: 50,
      },
      balls: this._getBalls(50),
    }
  }

  _spawnObjects() {
    this.setState({
      balls: this.state.balls.concat(this._getBalls(this.state.config.numToAdd)),
    })
  }

  _clear() {
    this.setState({
      hoveredBall: null,
      balls: [],
      collisions: []
    })
  }

  _onCameraRef(ref) {
    this._cameraFacade = ref
  }

  _onBallMouseOver(e) {
    this.setState({hoveredBall: e.target.id})
  }

  _onBallMouseOut() {
    this.setState({hoveredBall: null})
  }

  _onBallMouseUp(e) {
    const clickedBall = find(this.state.balls, d => d.id === e.target.id)
    clickedBall.radius *= 1.5
    this.forceUpdate()
  }

  _onBallDragStart(e) {
    this.setState({draggedBall: e.target.id})
  }

  _onBallDrag(e) {
    const draggedBall = find(this.state.balls, d => d.id === e.target.id)
    const dragPlaneY = draggedBall.y

    // Determine event's point on the orbital plane
    let systemTransformMatrix = new Matrix4().setPosition(0, dragPlaneY, 0).makeRotationX(-Math.PI / 2)

    let systemPlane = new Plane().setComponents(0, 0, 1, 0).applyMatrix4(systemTransformMatrix)
    let ray = e.ray //all pointer events in a 3D world are guaranteed to have a `ray`
    let posVec3 = ray.intersectPlane(systemPlane, new Vector3())
    if (posVec3) {
      posVec3.applyMatrix4(new Matrix4().getInverse(systemTransformMatrix))
      
      draggedBall.x = posVec3.x
      draggedBall.y =  posVec3.y
      draggedBall.z =  posVec3.z
      this.forceUpdate()
    }
  }

  _onBallDragEnd(e) {
    this.setState({
      // balls: balls.map(ball => {
      //   if (ball.id == this.state.draggedBall) {
      //     return {
      //       ...ball
            
      //     }          
      //   }
      //   return ball
      // }),
      draggedBall: null,
      droppableBall: null
    })
  }

  _onGroundCollision(e) {
    if (!e.collisionTarget) {
      return
    }
    const collidedBallColor = e.collisionTarget.color
    let newState = {
      groundColor: collidedBallColor
    }
    if (e.collisionContacts) {
      const firstContact = e.collisionContacts[0]
      const scaledForce = forceScale(firstContact.force)
      const MIN_FORCE = 2
      
      if (scaledForce >= MIN_FORCE) {
        firstContact.id = this.collisionId++
        firstContact.scaledForce = scaledForce
        firstContact.color = collidedBallColor

        this.state.collisions.push(firstContact)
        newState.collisions = this.state.collisions
        // newState.collisions.reverse()
        // newState.collisions.length = 40 // Max decals
        // newState.collisions.reverse()
      }
    }
    this.setState(newState)
  }

  render() {
    const state = this.state
    const {width, height} = this.props
    const {config} = state

    return (
      <div>
        <Canvas3D
          antialias
          stats={ this.props.stats }
          width={ width }
          shadows={true}
          height={ height }
          continuousRender={config.physicsActive} // for PhysicsManager
          lights={ [
            { type: 'ambient', color: 0x666666 },
            { 
              type: 'point', 
              color: 0xffffff,
              castShadow: true,
              x: 30,
              y: 30,
              z: 30,
            }
          ] }
          background={backgroundTexture}
          camera={ {
            x: 0,
            z: 25,
            y: 25,
            lookAt: {x:0,y:5,z:0},
            ref: this._onCameraRef,
            animation: [
              {
                0: {y: 20},
                100: {y: 5},
                duration: 20000,
                easing: 'easeInOutSine',
                iterations: Infinity,
                direction: 'alternate'
              }
            ]
          } }
          objects={ [
            {
              key: 'noPhysicsParent',
              facade: Ground,
              x: 0,
              y: 0,
              z: 0,
              // rotateY: Math.PI / 4,
              animation: [
                // {
                //   0: {x: -5},
                //   100: {x: 5},
                //   duration: 5000,
                //   iterations: Infinity,
                //   direction: 'alternate'
                // },
                // {
                //   0: {rotateY: 0},
                //   100: {rotateY: Math.PI * 2},
                //   duration: 30000,
                //   iterations: Infinity,
                // }
              ],
              castShadow: false,
              receiveShadow: true,
              children: [
                {
                  key: 'physicsManager',
                  facade: PhysicsManager,
                  y: 0,
                  x: 0,
                  //gravity: {x: 0, y: DEFAULT_GRAVITY, z: 0},
                  simulationEnabled: config.physicsActive,
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
                          color: state.groundColor,
                          castShadow: true,
                          receiveShadow: true,
                          physics: {
                            // collider: {
                            //   shape: 'box',
                            //   ctrArgs: [{
                            //     method: 'btVector3',
                            //     args: [sx * 0.5, sy * 0.5, sz * 0.5]
                            //   }]
                            // },
                            restitution: 0.5, // Slightly bouncy glass 
                            mass: 0,
                          },
                          environmentMap: backgroundTexture,
                          onCollision: this._onGroundCollision,
                          children: state.collisions.map((collision, i) => ({
                            key: collision.id,
                            facade: CollisionDecal,
                            y: 0,
                            collision: collision,
                            color: collision.color,
                            receiveShadow: true
                          }))
                        },
                        {
                          key: 'kinematicsOnlyObject',
                          facade: FanBlade,
                          x: 0,
                          y: config.bladeHeight,
                          z: 0,
                          rotateZ: Math.PI / 4,
                          animation: [
                            {
                              paused: !config.bladeSpinning,
                              0: {rotateY: 0},
                              100: {rotateY: Math.PI * 2},
                              duration: 1000 / config.bladeSpeed,
                              iterations: Infinity,
                            }
                          ],
                          radius: 1,
                          color: 0x000000,
                          opacity: 1,
                          physics: {
                            isKinematic: true,
                            mass: 0,
                            friction: 0.5,
                            restitution: 0.7,
                            // constraints: [
                            //   {
                            //     type: CONSTRAINTS.HINGE
                            //   }
                            // ]
                          },
                          environmentMap: backgroundTexture,
                          castShadow: true,
                          receiveShadow: true
                        },
                        ...state.balls.map((ball, i) => {
                          let isHoveredBall = state.hoveredBall === ball.id
                          let isDraggedBall = state.draggedBall === ball.id
                          const _facade = config.useInstanced === 'Instanced' ? (
                            ball.isBox ? PhysicsCubeInstanceable : PhysicsSphereInstanceable
                          ) : (
                            ball.isBox ? PhysicsCube : PhysicsSphere
                          )

                          return {
                            key: ball.id,
                            facade: _facade,
                            id: ball.id,
                            x: ball.x,
                            y: ball.y,
                            z: ball.z,
                            rotateX: ball.rotateX,
                            rotateY: ball.rotateY,
                            rotateZ: ball.rotateZ,
                            radius: ball.radius,
                            color: isDraggedBall ? 0xff0000 : (isHoveredBall ? 0xFFFFFF : ball.color),
                            opacity: 1,

                            physics: {
                              // isDisabled: isHoveredBall, //ball.physicsDisabled,
                              isPaused: isDraggedBall,
                              mass: ball.mass,
                              friction: ball.friction, //0.5,
                              rollingFriction: ball.friction,
                              restitution: ball.restitution,
                            },

                            pointerEvents: true,
                            onMouseOver: this._onBallMouseOver,
                            onMouseOut: this._onBallMouseOut,
                            onMouseUp: this._onBallMouseUp,

                            onDragStart: this._onBallDragStart,
                            onDrag: this._onBallDrag,
                            onDragEnd: this._onBallDragEnd,

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

        <DatGui data={state.config} onUpdate={this._onConfigUpdate}>
          <DatSelect path='useInstanced' options={['Instanced', 'Non-Instanced']} />

          <DatNumber path="numToAdd" label="Number of objects to spawn" min={1} max={10000} step={1} />
          <DatButton onClick={this._spawnObjects} label="Spawn objects" />
          <DatButton onClick={this._clear} label="Clear objects" />

          <DatNumber path="bladeHeight" label="Blade Height" min={0} max={5} step={0.5} />
          <DatNumber path="bladeSpeed" label="Blade Spin Rate" min={0.1} max={10} step={0.1} />
          <DatBoolean path="bladeSpinning" label="Blade Spin" />
          
          <DatBoolean path="physicsActive" label="Physics Running" />
        </DatGui>

        <div className="example_desc">
          <p>
            Dynamic Objects: {state.balls.length.toLocaleString()} <br />
            Collisions: {state.collisions.length.toLocaleString()}
          </p>
          <small>Image credits: http://www.humus.name/index.php</small>
        </div>
      </div>
    )
  }
}

PhysicsExample.propTypes = {
  width: T.number,
  height: T.number
}

export default PhysicsExample
