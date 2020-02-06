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

const sharedVec3 = new Vector3()
const DEFAULT_PHYSICS_OFF_CFG = { isDisabled: true, mass: 0 }

const PHYSICS_FRAMERATE_HZ = 90 // Physics "frames" per second cap
const _PHYSICS_FRAMERATE_INTERVAL = 1 / PHYSICS_FRAMERATE_HZ // Seconds

const DEBUG_MAX_BUFFER_SIZE = 1000000 // mirrored in ammo constants

export default class PhysicsManagerBase extends Group3DFacade {
  constructor (parent) {
    super(parent)

    this._debugging = false
    this.clock = new Clock()
    this.physicsWorldReady = false
    // this.hasBodyChanges = true

    // Separate cache of only physics-enabled facades
    // TODO use the prototype/parent's _object3DFacadesById cache and filter after?
    this._physicsObjectFacadesById = Object.create(null)
    this._nextBodyId = 1 // numeric index ID
    this._bodyIdsToFacadeIds = {}
    this._facadeIdsToBodyIds = {}

    // Bind events
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
      // console.log(`~~ Tick!`, renderDelta, ' millis:', renderDelta * 1000)
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
      // if (this._physicsBodyChangeset) {
      //   console.log(`~~ SENDING queued changeset`)
      //   this.tryRequestBodyChanges()
      // }
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

  // updateBodies () {
  //   throw new Error('PhysicsManager extensions must implement the `updateBodies` method')
  // }

  // receive (update) {
  //   if (!update) {
  //     return
  //   }
  //   if (update.physicsReady) {
  //     this.physicsWorldReady = true
  //     if (this._physicsBodyChangeset) {
  //       console.log(`~~ SENDING queued changeset`)
  //       this.tryRequestBodyChanges()
  //     }
  //   }
  //   if (update.rigidBodies) {
  //     this.handleRigidBodiesUpdated(update.rigidBodies)
  //   }
  //   if (update.softBodies) {
  //     this.handleSoftBodiesUpdated(update.softBodies)
  //   }
  //   if (update.collisions) {
  //     this.handleCollisionsUpdated(update.collisions)
  //   }
  //   this._latestDebugData = null
  //   if (update.debugDrawerOutput) {
  //     // console.log(`~~ YES DOOT` )

  //     this._latestDebugData = update.debugDrawerOutput
  //     // this.afterUpdate()
  //     // this.notifyWorld('needsRender')
  //     // this.handleDebugDrawerUpdated(update.debugDrawerOutput)
  //   } else {
  //     // console.log(`~~ NO DOOT` )

  //   }
  //   this.notifyWorld('needsRender')
  // }

  // requestPhysicsUpdate (deltaSec) {
  //   if (!this.physicsWorldReady) {
  //     return
  //   }

  //   const payload = Object.create(null)
  //   let _needsUpdate = false

  //   if (this.simulationEnabled) {
  //     _needsUpdate = true
  //     payload.updateDeltaTime = this.clock.getDelta() // Instruct the worker to advance the physics simulation
  //   }

  //   // update worker physics world with any changed physics-enabled descendant facades
  //   if (this.hasBodyChanges && this._physicsBodyChangeset) {
  //     _needsUpdate = true
  //     const {
  //       add,
  //       remove,
  //       update
  //     } = this._physicsBodyChangeset

  //     payload.bodyChanges = Object.create(null)
  //     if (add) {
  //       payload.bodyChanges.add = Object.keys(add).map(facadeId => {
  //         // Check for add requests for objects that are now obsolete
  //         const facade = this._physicsObjectFacadesById[facadeId]
  //         if (facade && !facade.isDestroying && !(remove && remove[facadeId])) {
  //           const pos = facade.threeObject.position
  //           const quat = facade.threeObject.quaternion
  //           facade.physics = facade.physics || DEFAULT_PHYSICS_OFF_CFG
  //           if (!facade.$physicsShapeConfig) {
  //             // Auto-generate physics shape from ThreeJS geometry if not provided
  //             facade.$physicsShapeConfig = inferPhysicsShape(facade)
  //           }

  //           // FIXME need to get matrixWorld offsets for initial pos
  //           return {
  //             facadeId,
  //             shapeConfig: facade.$physicsShapeConfig,
  //             physicsConfig: facade.physics,
  //             initialPos: {
  //               x: pos.x,
  //               y: pos.y,
  //               z: pos.z
  //             },
  //             initialQuat: {
  //               x: quat.x,
  //               y: quat.y,
  //               z: quat.z,
  //               w: quat.w
  //             }
  //           }
  //         }
  //       })
  //     }
  //     if (update) {
  //       // Single batched update request
  //       payload.bodyChanges.update = update
  //     }
  //     if (remove) {
  //       payload.bodyChanges.remove = Object.keys(remove)
  //     }
  //     this._physicsBodyChangeset = null
  //   }

  //   if (_needsUpdate) {
  //     // Submit the update payload to the Physics World
  //     this.request(payload)
  //   }
  // }

  /**
   * Intercept child `notifyWorld` calls,
   * forwarding unhandled messages up to parents
   */
  onNotifyWorld (source, message, data) {
    const handler = this._notifyWorldHandlers[message]
    if (handler) {
      handler.call(this, source, data)
    } else if (this.parent) {
      this.parent.onNotifyWorld(source, message, data)
    }
  }

  // // Manager props
  // get simulationEnabled () {
  //   return this._simulationEnabled
  // }

  // set simulationEnabled (isEnabled) {
  //   this._simulationEnabled = isEnabled
  //   if (isEnabled) {
  //     console.log(`~~ NEED RENDER`)

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

  handleRigidBodiesUpdate (rigidBodies, numBodies, baseOffset, itemSize) {
    let index = numBodies

    while (index--) {
      const offset = baseOffset + index * itemSize
      const bodyId = rigidBodies[offset + 0]
      if (bodyId === 0) {
        continue
      }
      const facadeId = this._bodyIdsToFacadeIds[bodyId]
      const facade = this._physicsObjectFacadesById[facadeId]

      if (facade && !facade.physics.isKinematic) {
        // console.log(`~~ UPDATE RIGID @(${offset}):`, bodyId, facadeId)
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

    // this.notifyWorld('needsRender')

    // for (let i = 0, iLen = rigidBodies.length; i < iLen; i++) {
    //   const [facadeId, px, py, pz, qx, qy, qz, qw] = rigidBodies[i]
    //   const facade = this._physicsObjectFacadesById[facadeId]
    //   if (facade && !facade.physics.isKinematic) {
    //     facade.$isPhysicsControlled = true

    //     facade.threeObject.position.set(px, py, pz)
    //     facade.threeObject.quaternion.set(qx, qy, qz, qw)

    //     // TODO pass down linearVelocity and angularVelocity data

    //     if (!facade._matrixChanged) {
    //       facade._matrixChanged = true
    //     }
    //     facade.afterUpdate()
    //   }
    // }
  }

  handleDebugUpdate (debugData, drawOnTop, startIndex, endIndex, positionOffset, colorOffset) {
    if (!this._debuggerMesh) {
      return
    }

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

  handleSoftBodiesUpdated (softBodies) {
    for (let i = 0, iLen = softBodies.length; i < iLen; i++) {
      const [facadeId, nodes] = softBodies[i]
      const facade = this._physicsObjectFacadesById[facadeId]

      if (facade && !facade.physics.isKinematic) {
        facade.$isPhysicsControlled = true

        const geom = facade.threeObject.geometry
        const volumePositions = geom.attributes.position.array
        const volumeNormals = geom.attributes.normal.array
        const association = geom.$physicsIndexAssociation

        var numVerts = association.length
        const flattenedDims = 6
        for (let j = 0; j < numVerts; j++) {
          var assocVertex = association[j]
          const dj = j * flattenedDims
          let x = nodes[dj + 0]
          let y = nodes[dj + 1]
          let z = nodes[dj + 2]
          const nx = nodes[dj + 3]
          const ny = nodes[dj + 4]
          const nz = nodes[dj + 5]

          sharedVec3.set(x, y, z)
          facade.threeObject.worldToLocal(sharedVec3) // Translate world-space coords back to local

          x = sharedVec3.x
          y = sharedVec3.y
          z = sharedVec3.z

          for (var k = 0, kl = assocVertex.length; k < kl; k++) {
            var indexVertex = assocVertex[k]

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

        geom.attributes.position.needsUpdate = true
        geom.attributes.normal.needsUpdate = true

        if (!facade._matrixChanged) {
          facade._matrixChanged = true
        }
        facade.afterUpdate()
      }
    }
  }

  _fireCollisionEvent (facadeId, otherFacadeId, contacts) {
    // Fire onCollision event for each facade that registered for the event
    const targetFacade = this._physicsObjectFacadesById[facadeId]
    const collisionFacade = this._physicsObjectFacadesById[otherFacadeId]
    if (!targetFacade || !collisionFacade) {
      return
    }
    const newEvent = new CollisionEvent(
      'collision', // eventType
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

  handleCollisionsUpdated (collisions) {
    collisions.forEach(collision => {
      const [facadeIdA, facadeIdB, contacts] = collision
      this._fireCollisionEvent(facadeIdA, facadeIdB, contacts)
      this._fireCollisionEvent(facadeIdB, facadeIdA, contacts)
    })
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
    // if (!facade.physics$descriptor) {
    //   console.log(`~~ no physics for facade:`, facade)

    //   return
    // }
    const changes = this._physicsBodyChangeset || (this._physicsBodyChangeset = {})
    const map = changes[changeType] || (changes[changeType] = Object.create(null))

    switch (changeType) {
      case 'update': {
        map[facade.$facadeId] = facade
        break
      }
      case 'remove': {
        facade.$isPhysicsControlled = false
        delete facade.$physicsBodyId

        delete this._facadeIdsToBodyIds[facade.$facadeId]
        delete this._physicsObjectFacadesById[facade.$facadeId]
        delete this._bodyIdsToFacadeIds[facade.$physicsBodyId]

        map[facade.$facadeId] = facade
        break
      }
      case 'add': {
        const bodyId = this._nextBodyId++

        this._bodyIdsToFacadeIds[bodyId] = facade.$facadeId
        this._facadeIdsToBodyIds[facade.$facadeId] = bodyId
        this._physicsObjectFacadesById[facade.$facadeId] = facade

        facade.$physicsBodyId = bodyId
        map[facade.$facadeId] = facade
        break
      }
    }
  }

  getQueuedChanges () {
    if (this.physicsWorldReady && this._physicsBodyChangeset) {
      const payload = Object.create(null)
      const {
        add,
        remove,
        update
      } = this._physicsBodyChangeset

      if (add) {
        payload.add = Object.keys(add).map(facadeId => {
          // Check for add requests for objects that are now obsolete
          const facade = this._physicsObjectFacadesById[facadeId]
          if (facade && !facade.isDestroying && !(remove && remove[facadeId])) {
            // const pos = facade.threeObject.position
            // const quat = facade.threeObject.quaternion
            facade.physics = facade.physics || DEFAULT_PHYSICS_OFF_CFG
            if (!facade.$physicsShapeConfig) {
              // Auto-generate physics shape from ThreeJS geometry if not provided
              facade.$physicsShapeConfig = inferPhysicsShape(facade)
            }

            return {
              facadeId: facadeId,
              bodyId: facade.$physicsBodyId,
              shapeConfig: facade.$physicsShapeConfig,
              physicsConfig: facade.physics,
              initialMatrixWorld: facade.threeObject.matrixWorld.elements
              // FIXME need to get matrixWorld offsets for initial pos
              // initialPos: {
              //   x: pos.x,
              //   y: pos.y,
              //   z: pos.z
              // },
              // initialQuat: {
              //   x: quat.x,
              //   y: quat.y,
              //   z: quat.z,
              //   w: quat.w
              // }
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

      // this.updateBodies(payload)
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
  // physicsObjectScaleChange (source, args) {
  //   this.queuePhysicsWorldChange('update', source, ['rescale', args])
  // },
  // physicsObjectMatrixChange (source, args) {
  //   // Handle troika-provided matrix (position and orientation) changes.
  //   // Applies to physics objects with zero mass (Kinematics-only objects),
  //   // and those that may not be under control of the dynamics world yet
  //   this.queuePhysicsWorldChange('update', source, ['worldMatrixChange', args])
  // },
  // physicsObjectDisabledChange (source, isDisabled) {
  //   if (isDisabled) {
  //     this.queuePhysicsWorldChange('remove', source)
  //   } else {
  //     this.queuePhysicsWorldChange('add', source)
  //   }
  // },
  // physicsObjectConfigChange (source, args) {
  //   this.queuePhysicsWorldChange('update', source, ['configChange', args])
  // }

  // updatePhysicsShape (source, shapeMethodConfig) {
  //   const facadeId = source.$facadeIdå
  //   this.request('updatePhysicsShape', [facadeId, shapeMethodConfig])
  // }
}
