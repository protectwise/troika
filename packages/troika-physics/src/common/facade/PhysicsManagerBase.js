/* eslint-env browser */
import {
  Clock,
  Vector3,
  BufferGeometry,
  BufferAttribute,
  LineSegments,
  LineBasicMaterial,
  VertexColors
} from 'three'
import { Group3DFacade } from 'troika-3d'
import CollisionEvent from '../events/CollisionEvent'
import { inferPhysicsShape } from '../utils/inferPhysicsShape'
import CONSTANTS from '../constants'

const sharedVec3 = new Vector3()
const DEFAULT_PHYSICS_OFF_CFG = { isDisabled: true, mass: 0 }

const PHYSICS_FRAMERATE_HZ = 90 // Physics "frames" per second cap
const _PHYSICS_FRAMERATE_INTERVAL = 1 / PHYSICS_FRAMERATE_HZ // Seconds

const {
  MSG_HDR_SZ,
  RIGID_MSG_SIZE,
  DEBUG_MSG,
  DEBUG_MAX_BUFFER_SIZE,
  SOFT_BODY_TYPE,
  SOFT_BODY_MSG_SIZES,
  COLLISION_SIZE,
  CONTACT_SIZE
} = CONSTANTS

export default class PhysicsManagerBase extends Group3DFacade {
  constructor (parent) {
    super(parent)

    this._debugging = false
    this.clock = new Clock()
    this.physicsWorldReady = false

    this._physicsObjectFacadesById = Object.create(null)
    this._nextBodyId = 1 // numeric index ID
    this._bodyIdsToFacadeIds = {}
    this._facadeIdsToBodyIds = {}

    this.tick = this.tick.bind(this)
    this.initPhysics = this.initPhysics.bind(this)
    this.updatePhysicsWorld = this.updatePhysicsWorld.bind(this)
    this.updateDebugOptions = this.updateDebugOptions.bind(this)
    this.handleInit = this.handleInit.bind(this)
    this.getQueuedChanges = this.getQueuedChanges.bind(this)

    this.initPhysics().then(this.handleInit)

    this.tick()
  }

  _requestPhysicsFrame (callback) {
    // FIXME use world renderingScheduler for XR support (if physics updates at display rate are desired)
    return window.requestAnimationFrame(callback)
  }

  tick () {
    // const delta = this.clock.getDelta()
    const elapsed = this.clock.getElapsedTime()
    const renderDelta = elapsed - this._lastUpdateTime
    // Cap physics framerate to fixed target
    if (renderDelta > _PHYSICS_FRAMERATE_INTERVAL) {
      // this.requestPhysicsUpdate(renderDelta)
      const doTick = this.physicsWorldReady && this.simulationEnabled
      if (doTick) {
        this.updatePhysicsWorld(
          // delta, //
          renderDelta,
          this.getQueuedChanges()
        )
        this._lastUpdateTime = elapsed
      }
    }
    this._requestPhysicsFrame(this.tick)
  }

  handleInit ({ physicsReady }) {
    if (physicsReady) {
      this.physicsWorldReady = true
      this.clock.start()
      this._lastUpdateTime = 0
    }
  }

  /**
   * Async request to update the Physics World. Pa
   * Physics Manager implementations _must_ implement this method
   *
   * @memberof PhysicsManagerWorker
   * @template
   * @param {number} updateDeltaTime - Instruction to advance the physics simulation by this amount of time. Milliseconds since most recent update call.
   */
  updatePhysicsWorld (updateDeltaTime) {
    throw new Error('PhysicsManager extensions must implement the `updatePhysicsWorld` method')
  }

  /**
   * Async request to update the Physics World. Pa
   * Physics Manager implementations _must_ implement this method
   *
   * @memberof PhysicsManagerWorker
   * @template
   * @param {number} debuggerOptions
   */
  updateDebugOptions (options) {
    throw new Error('PhysicsManager extensions must implement the `updateDebugOptions` method')
  }

  /**
   * Intercept child `notifyWorld` calls,
   * forwarding unhandled messages up to parents
   */
  onNotifyWorld (source, message, data) {
    const handler = this._notifyWorldHandlers[message]
    const listener = this._notifyWorldListeners[message] // "Soft" handler that does not intercept "event" bubbling up to parents
    if (handler) {
      handler.call(this, source, data)
      return
    }
    if (listener) {
      listener.call(this, source, data)
    }
    if (this.parent) {
      this.parent.onNotifyWorld(source, message, data)
    }
  }

  // get simulationEnabled () {
  //   return this._simulationEnabled
  // }

  // set simulationEnabled (isEnabled) {
  //   this._simulationEnabled = isEnabled
  //   if (isEnabled) {
  //     this.notifyWorld('needsRender')
  //   }
  // }

  set debug (isDebugging) {
    if (isDebugging !== this._debugging) {
      if (isDebugging) {
        if (!this._debuggerMesh) {
          const drawOnTop = false
          const geometry = new BufferGeometry()
          const vertices = new Float32Array(DEBUG_MAX_BUFFER_SIZE * 3)
          const colors = new Float32Array(DEBUG_MAX_BUFFER_SIZE * 3)
          geometry.addAttribute('position', new BufferAttribute(vertices, 3).setDynamic(true))
          geometry.addAttribute('color', new BufferAttribute(colors, 3).setDynamic(true))

          const material = new LineBasicMaterial({
            vertexColors: VertexColors,
            depthTest: !drawOnTop
            // depthWrite: false,
            // side: BackSide
          })

          this._debuggerMesh = new LineSegments(geometry, material)
          if (drawOnTop) {
            this._debuggerMesh.renderOrder = 999
          }
          this._debuggerMesh.frustumCulled = false

          this._parentObject3DFacade.threeObject.add(this._debuggerMesh)
        }
      } else {
        this._parentObject3DFacade.threeObject.remove(this._debuggerMesh)
        delete this._debuggerMesh
      }

      // Notify the engine about the debug change
      this.updateDebugOptions({
        enabled: isDebugging
      })
    }
    this._debugging = isDebugging
  }

  get debug () {
    return this._debugging
  }

  handleRigidBodiesUpdate (rigidBodies, numBodies) {
    let index = numBodies

    while (index--) {
      const offset = MSG_HDR_SZ + index * RIGID_MSG_SIZE
      const bodyId = rigidBodies[offset + 0]
      if (bodyId === 0) {
        continue
      }
      const facadeId = this._bodyIdsToFacadeIds[bodyId]
      const facade = this._physicsObjectFacadesById[facadeId]

      if (facade && !facade.physics.isKinematic) {
        facade.$isPhysicsControlled = true

        facade.threeObject.position.set(
          rigidBodies[offset + 1],
          rigidBodies[offset + 2],
          rigidBodies[offset + 3]
        )
        facade.threeObject.quaternion.set(
          rigidBodies[offset + 4],
          rigidBodies[offset + 5],
          rigidBodies[offset + 6],
          rigidBodies[offset + 7]
        )

        // TODO pass down linearVelocity and angularVelocity data (offsets 8-13)?

        if (!facade._matrixChanged) {
          facade._matrixChanged = true
        }
        facade.afterUpdate()
      }
    }
  }

  handleSoftBodiesUpdate (bodyUpdate, numBodies) {
    let index = numBodies
    let offset = MSG_HDR_SZ

    while (index--) {
      const bodyId = bodyUpdate[offset] // SOFT_BODY_MSG_SIZES.HDR[0]
      const softBodyType = bodyUpdate[offset + 1] // SOFT_BODY_MSG_SIZES.HDR[1]
      const bodyUpdateSize = bodyUpdate[offset + 2] // SOFT_BODY_MSG_SIZES.HDR[2] Will vary based on number of mesh vertices
      if (bodyId === 0) {
        continue
      }
      const facadeId = this._bodyIdsToFacadeIds[bodyId]
      const facade = this._physicsObjectFacadesById[facadeId]

      if (facade && !facade.physics.isKinematic) {
        facade.$isPhysicsControlled = true

        const geom = facade.threeObject.geometry
        const volumePositions = geom.attributes.position.array
        const association = geom.$physicsIndexAssociation

        const offsetVert = offset + SOFT_BODY_MSG_SIZES.HDR

        // if (!data.isSoftBodyReset) {
        //   object.position.set(0, 0, 0);
        //   object.quaternion.set(0, 0, 0, 0);

        //   data.isSoftBodyReset = true;
        // }

        switch (softBodyType) {
          case SOFT_BODY_TYPE.TRIMESH: // TODO if we update to Bullet 3+, use `m_faces` for triangle meshes. Currently it uses the same strategy as a 2d cloth
          case SOFT_BODY_TYPE.CLOTH: {
            const volumeNormals = geom.attributes.normal.array

            for (let assocVertexI = 0, numAssocVertices = association.length; assocVertexI < numAssocVertices; assocVertexI++) {
              const assocVertex = association[assocVertexI]
              const offs = offsetVert + (assocVertexI * SOFT_BODY_MSG_SIZES.TRIMESH)

              let x = bodyUpdate[offs + 0]
              let y = bodyUpdate[offs + 1]
              let z = bodyUpdate[offs + 2]
              const nx = bodyUpdate[offs + 3]
              const ny = bodyUpdate[offs + 4]
              const nz = bodyUpdate[offs + 5]

              // Translate world-space coords back to local
              sharedVec3.set(x, y, z)
              facade.threeObject.worldToLocal(sharedVec3)
              x = sharedVec3.x
              y = sharedVec3.y
              z = sharedVec3.z

              for (let k = 0, kl = assocVertex.length; k < kl; k++) {
                let indexVertex = assocVertex[k]

                volumePositions[indexVertex] = x
                volumeNormals[indexVertex] = nx
                indexVertex++
                volumePositions[indexVertex] = y
                volumeNormals[indexVertex] = ny
                indexVertex++
                volumePositions[indexVertex] = z
                volumeNormals[indexVertex] = nz
              }
            }

            geom.attributes.normal.needsUpdate = true
            offset += SOFT_BODY_MSG_SIZES.HDR + (bodyUpdateSize * SOFT_BODY_MSG_SIZES.TRIMESH)

            break
          }
          case SOFT_BODY_TYPE.ROPE: {
            for (let assocVertexI = 0, numAssocVertices = association.length; assocVertexI < numAssocVertices; assocVertexI++) {
              const assocVertex = association[assocVertexI]
              const offs = offsetVert + (assocVertexI * SOFT_BODY_MSG_SIZES.ROPE)

              // if (isNaN(bodyUpdate[offs + 0])) {
              //   return
              // }

              let x = bodyUpdate[offs + 0]
              let y = bodyUpdate[offs + 1]
              let z = bodyUpdate[offs + 2]

              // Translate world-space coords back to local
              sharedVec3.set(x, y, z)
              facade.threeObject.worldToLocal(sharedVec3)
              x = sharedVec3.x
              y = sharedVec3.y
              z = sharedVec3.z

              for (let k = 0, kl = assocVertex.length; k < kl; k++) {
                let indexVertex = assocVertex[k]

                volumePositions[indexVertex] = x
                indexVertex++
                volumePositions[indexVertex] = y
                indexVertex++
                volumePositions[indexVertex] = z
              }
            }

            offset += SOFT_BODY_MSG_SIZES.HDR + (bodyUpdateSize * SOFT_BODY_MSG_SIZES.ROPE)

            break
          }
          default:
            console.error(`Unknown Soft Body Type: ${softBodyType}`)
            break
        }

        geom.attributes.position.needsUpdate = true

        if (!facade._matrixChanged) {
          facade._matrixChanged = true
        }
        facade.afterUpdate()
      }
    }
  }

  handleDebugUpdate (debugData) {
    const needsUpdate = Boolean(debugData[MSG_HDR_SZ + DEBUG_MSG.NEEDS_UPDATE])
    if (!this._debuggerMesh || !needsUpdate) {
      return
    }

    const drawOnTop = Boolean(debugData[MSG_HDR_SZ + DEBUG_MSG.DRAW_ON_TOP])
    const startIndex = debugData[MSG_HDR_SZ + DEBUG_MSG.GEOM_DRAW_RANGE_IDX_START]
    const endIndex = debugData[MSG_HDR_SZ + DEBUG_MSG.GEOM_DRAW_RANGE_IDX_END]
    const positionOffset = MSG_HDR_SZ + DEBUG_MSG.POSITIONS_BASE
    const colorOffset = MSG_HDR_SZ + DEBUG_MSG.COLORS_BASE

    const _p = this._debuggerMesh.geometry.attributes.position.array
    const _c = this._debuggerMesh.geometry.attributes.color.array

    for (let i = startIndex; i < (endIndex * 3); i++) {
      _p[i] = debugData[positionOffset + i]
      _c[i] = debugData[colorOffset + i]
    }

    this._debuggerMesh.geometry.attributes.position.needsUpdate = true
    this._debuggerMesh.geometry.attributes.color.needsUpdate = true

    this._debuggerMesh.geometry.setDrawRange(startIndex, endIndex)

    this._debuggerMesh.material.depthTest = !drawOnTop

    if (drawOnTop) {
      this._debuggerMesh.renderOrder = 999
    }
  }

  _fireCollisionEvent (bodyId, otherBodyId, contacts) {
    // Fire onCollision event for each facade that registered for the event
    const facadeId = this._bodyIdsToFacadeIds[bodyId]
    const otherFacadeId = this._bodyIdsToFacadeIds[otherBodyId]
    const targetFacade = this._physicsObjectFacadesById[facadeId]
    const collisionFacade = this._physicsObjectFacadesById[otherFacadeId]
    if (!targetFacade || !collisionFacade) {
      return
    }
    const newEvent = new CollisionEvent(
      'collision',
      targetFacade,
      collisionFacade,
      contacts
    )
    function callHandler (handler) {
      handler.call(targetFacade, newEvent)
    }
    this.notifyWorld('dispatchEvent', {
      targetFacade,
      type: 'collision',
      handler: callHandler
    })
  }

  handleCollisionsUpdate (data, numCollisions) {
    let index = numCollisions

    while (index--) {
      const offset = MSG_HDR_SZ + (index * COLLISION_SIZE)
      const bodyAId = data[offset + 0]
      const bodyBId = data[offset + 1]
      const numContacts = data[offset + 2]
      const contacts = new Array(numContacts)
      for (let contactIdx = 0; contactIdx < numContacts; contactIdx++) {
        const contactOffset = offset + 3 + (CONTACT_SIZE * contactIdx)
        contacts[contactIdx] = {
          // World-space position of contact on the receiving object (Object A)
          targetXYZ: [
            data[contactOffset + 0],
            data[contactOffset + 1],
            data[contactOffset + 2]
          ],
          // World-space position of contact on the colliding object (Object B)
          sourceXYZ: [
            data[contactOffset + 3],
            data[contactOffset + 4],
            data[contactOffset + 5]
          ],
          // World-space normal vector.
          // The normal is pointing from Object B towards Object A.
          // https://pybullet.org/Bullet/phpBB3/viewtopic.php?t=6620
          normalXYZ: [
            data[contactOffset + 6],
            data[contactOffset + 7],
            data[contactOffset + 8]
          ],
          impulse: data[contactOffset + 9], // N•s
          force: data[contactOffset + 10] // N
        }
      }

      // Fire a collision event for both participants
      this._fireCollisionEvent(bodyAId, bodyBId, contacts)
      this._fireCollisionEvent(bodyBId, bodyAId, contacts)
    }
  }

  /**
   * Handle child physics objects being added, removed, or updated
   *
   * @param {string} changeType ('add'|'update'|'remove')
   * @param {Facade} facade
   * @param {array} args
   * @template
   */
  queuePhysicsWorldChange (changeType, facade, args) {
    const changes = this._physicsBodyChangeset || (this._physicsBodyChangeset = {})
    const changeSet = changes[changeType] || (changes[changeType] = Object.create(null))

    switch (changeType) {
      case 'update': {
        changeSet[facade.$facadeId] = facade
        break
      }
      case 'remove': {
        facade.$isPhysicsControlled = false
        delete facade.$physicsBodyId

        delete this._facadeIdsToBodyIds[facade.$facadeId]
        delete this._physicsObjectFacadesById[facade.$facadeId]
        delete this._bodyIdsToFacadeIds[facade.$physicsBodyId]

        changeSet[facade.$facadeId] = facade
        break
      }
      case 'add': {
        const bodyId = this._nextBodyId++

        this._bodyIdsToFacadeIds[bodyId] = facade.$facadeId
        this._facadeIdsToBodyIds[facade.$facadeId] = bodyId
        this._physicsObjectFacadesById[facade.$facadeId] = facade

        facade.$physicsBodyId = bodyId
        changeSet[facade.$facadeId] = facade
        break
      }
      case 'listenerAdd': {
        changeSet[facade.$facadeId] = facade
        break
      }
      case 'listenerRemove': {
        changeSet[facade.$facadeId] = facade
        break
      }
      default: {
        console.error(`Unrecognized changeType: ${changeType}`)
      }
    }
  }

  getQueuedChanges () {
    if (this.physicsWorldReady && this._physicsBodyChangeset) {
      const payload = Object.create(null)
      const {
        add,
        remove,
        update,
        listenerAdd,
        listenerRemove
      } = this._physicsBodyChangeset

      if (add) {
        payload.add = Object.keys(add).map(facadeId => {
          const facade = this._physicsObjectFacadesById[facadeId]
          if (facade && !facade.isDestroying && !(remove && remove[facadeId])) {
            facade.physics = facade.physics || DEFAULT_PHYSICS_OFF_CFG
            if (!facade.$physicsShapeConfig) {
              facade.$physicsShapeConfig = inferPhysicsShape(facade)
            }

            return {
              facadeId: facadeId,
              bodyId: facade.$physicsBodyId,
              shapeConfig: facade.$physicsShapeConfig,
              physicsConfig: facade.physics,
              initialMatrixWorld: facade.threeObject.matrixWorld.elements
            }
          }
        })
      }
      if (update) {
        payload.update = Object.keys(update).reduce((output, facadeId) => {
          const facade = this._physicsObjectFacadesById[facadeId]
          if (facade) {
            const _update = {
              facadeId: facadeId,
              bodyId: facade.$physicsBodyId
            }
            if (facade.$physicsDirty_Config) {
              _update.physicsConfig = facade.physics
            }
            if (facade.$physicsDirty_Matrix) {
              _update.matrix = facade.threeObject.matrixWorld.elements
            }
            if (facade.$physicsDirty_Scale) {
              _update.scale = [facade.scaleX, facade.scaleY, facade.scaleZ]
            }
            output.push(_update)
          } else {
            console.warn(`troika-physics: Update queued for unknown facade (not current in _physicsObjectFacadesById): "${facadeId}"`)
          }
          return output
        }, [])
      }
      if (remove) {
        payload.remove = Object.keys(remove)
      }
      if (listenerAdd) {
        payload.listenerAdd = Object.keys(listenerAdd)
      }
      if (listenerRemove) {
        payload.listenerRemove = Object.keys(listenerRemove)
      }

      this._physicsBodyChangeset = null
      return payload
    }
    return null
  }

  destructor () {
    for (const facadeId in this._physicsObjectFacadesById) {
      const facade = this._physicsObjectFacadesById[facadeId]
      delete facade.$physicsBodyId
      facade.$isPhysicsControlled = false // release physics control of pos/rot props
    }

    this._physicsObjectFacadesById = Object.create(null)
    this._nextBodyId = 1
    this._bodyIdsToFacadeIds = {}
    this._facadeIdsToBodyIds = {}

    super.destructor()
  }
}

PhysicsManagerBase.prototype._notifyWorldListeners = {
  addEventListener (source, data) {
    if (data.type === 'collision') {
      this.queuePhysicsWorldChange('listenerAdd', source)
    }
  },
  removeEventListener (source, data) {
    if (data.type === 'collision') {
      this.queuePhysicsWorldChange('listenerRemove', source)
    }
  },
  removeAllEventListeners (source) {
    this.queuePhysicsWorldChange('listenerRemove', source)
  }
}

PhysicsManagerBase.prototype._notifyWorldHandlers = {
  physicsObjectAdded (source) {
    this.queuePhysicsWorldChange('add', source)
  },
  physicsObjectRemoved (source) {
    this.queuePhysicsWorldChange('remove', source)
  },
  physicsObjectNeedsUpdate (source) {
    this.queuePhysicsWorldChange('update', source)
  }
  // updatePhysicsShape (source, shapeMethodConfig) {
  //   const facadeId = source.$facadeIdå
  //   this.request('updatePhysicsShape', [facadeId, shapeMethodConfig])
  // }
}
