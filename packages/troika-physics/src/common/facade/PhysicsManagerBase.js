/* eslint-env browser */
import { Clock, Vector3 } from 'three'
import { Group3DFacade } from 'troika-3d'
import CollisionEvent from '../events/CollisionEvent'
import { inferPhysicsShape } from '../utils/inferPhysicsShape'

const sharedVec3 = new Vector3()

export default class PhysicsManagerBase extends Group3DFacade {
  constructor (parent) {
    super(parent)

    this.clock = new Clock()
    this.physicsWorldReady = false
    this.hasBodyChanges = true

    // Separate cache of only physics-enabled facades
    // TODO use the prototype/parent's _object3DFacadesById cache and filter after?
    this._physicsObjectFacadesById = Object.create(null)

    this.addEventListener('beforerender', this.requestPhysicsUpdate.bind(this))

    this.initPhysicsWorld()
  }

  /**
   * Async request to update the Physics World. Pa
   * Physics Manager implementations _must_ implement this method
   *
   * @memberof PhysicsManagerWorker
   * @template
   *
   * @param {object} payload - The update payload. May contain
   * @param {number} payload.updateDeltaTime - Instruction to advance the physics simulation by this amount of time. Milliseconds since most recent update call.
   * @param {object} payload.bodyChanges - Set of changes to physics bodies/colliders
   *
   * @returns {Promise}
   */
  updatePhysicsWorld (payload) {
    throw new Error('PhysicsManager extensions must implement the `updatePhysicsWorld` method')
  }

  initPhysicsWorld () {
    this.updatePhysicsWorld({ init: true }, initPayload => {
      this.physicsWorldReady = true
      this.notifyWorld('needsUpdate')
    })
  }

  handlePhysicsWorldResponse (update) {
    if (!update) {
      return
    }
    if (update.rigidBodies) {
      this.handleRigidBodiesUpdated(update.rigidBodies)
    }
    if (update.softBodies) {
      this.handleSoftBodiesUpdated(update.softBodies)
    }
    if (update.collisions) {
      this.handleCollisionsUpdated(update.collisions)
    }
  }

  requestPhysicsUpdate () {
    if (!this.physicsWorldReady) {
      return
    }

    const payload = Object.create(null)
    let _needsUpdate = false

    if (this.simulationEnabled) {
      _needsUpdate = true
      payload.updateDeltaTime = this.clock.getDelta() // Instruct the worker to advance the physics simulation
    }

    // update worker physics world with any changed physics-enabled descendant facades
    if (this.hasBodyChanges && this._physicsBodyChangeset) {
      _needsUpdate = true
      const {
        add,
        remove,
        update
      } = this._physicsBodyChangeset

      payload.bodyChanges = Object.create(null)

      if (add) {
        payload.bodyChanges.add = Object.keys(add).map(facadeId => {
          // Check for add requests for objects that are now obsolete
          const facade = this._physicsObjectFacadesById[facadeId]
          if (facade && !facade.isDestroying && !(remove && remove[facadeId])) {
            const pos = facade.threeObject.position
            const quat = facade.threeObject.quaternion

            if (!facade.$physicsShapeConfig) {
              // Auto-generate physics shape from ThreeJS geometry if not provided
              facade.$physicsShapeConfig = inferPhysicsShape(facade)
            }

            // FIXME need to get matrixWorld offsets for initial pos
            return {
              facadeId,
              shapeConfig: facade.$physicsShapeConfig,
              physicsConfig: facade.physics,
              initialPos: {
                x: pos.x,
                y: pos.y,
                z: pos.z
              },
              initialQuat: {
                x: quat.x,
                y: quat.y,
                z: quat.z,
                w: quat.w
              }
            }
          }
        })
      }
      if (update) {
        // Single batched update request
        payload.bodyChanges.update = update
      }
      if (remove) {
        payload.bodyChanges.remove = Object.keys(remove)
      }
      this._physicsBodyChangeset = null
    }

    if (_needsUpdate) {
      // Submit the update payload to the Physics World
      this.updatePhysicsWorld(payload, this.handlePhysicsWorldResponse.bind(this))
    }
  }

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

  handleRigidBodiesUpdated (rigidBodies) {
    for (let i = 0, iLen = rigidBodies.length; i < iLen; i++) {
      const [facadeId, px, py, pz, qx, qy, qz, qw] = rigidBodies[i]
      const facade = this._physicsObjectFacadesById[facadeId]
      if (facade && !facade.physics.isKinematic) {
        facade.$isControlledByDynamicsWorld = true

        facade.threeObject.position.set(px, py, pz)
        facade.threeObject.quaternion.set(qx, qy, qz, qw)

        if (!facade._matrixChanged) {
          facade._matrixChanged = true
        }
        facade.afterUpdate()
      }
    }
  }

  handleSoftBodiesUpdated (softBodies) {
    for (let i = 0, iLen = softBodies.length; i < iLen; i++) {
      const [facadeId, nodes] = softBodies[i]
      const facade = this._physicsObjectFacadesById[facadeId]

      if (facade && !facade.physics.isKinematic) {
        facade.$isControlledByDynamicsWorld = true

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
    const changes = this._physicsBodyChangeset || (this._physicsBodyChangeset = {})
    const map = changes[changeType] || (changes[changeType] = Object.create(null))
    if (changeType === 'update') {
      // Updates are merged/batched for a particular facade
      // Update values are a nested map of change requests, keyed by `updateType`
      map[facade.$facadeId] = map[facade.$facadeId] || Object.create(null)
      const [updateType, updateArgs] = args
      if (map[facade.$facadeId][updateType]) {
        console.warn(`_queuePhysicsWorldChange overwriting unsent update type for ${facade.$facadeId}: ${updateType}`)
      }
      map[facade.$facadeId][updateType] = updateArgs
    } else {
      // Add/Remove are simple single-entries
      map[facade.$facadeId] = facade
    }
    this.hasBodyChanges = true // Flag for an update next render
  }

  destructor () {
    for (const facadeId in this._physicsObjectFacadesById) {
      const facade = this._physicsObjectFacadesById[facadeId]
      facade.$isControlledByDynamicsWorld = false // release physics control of pos/rot props
    }
    super.destructor()
  }
}

PhysicsManagerBase.prototype._notifyWorldHandlers = {
  physicsObjectAdded (source) {
    this._physicsObjectFacadesById[source.$facadeId] = source
    this.queuePhysicsWorldChange('add', source)
  },
  physicsObjectRemoved (source) {
    source.$isControlledByDynamicsWorld = false
    delete this._physicsObjectFacadesById[source.$facadeId]
    this.queuePhysicsWorldChange('remove', source)
  },
  physicsObjectScaleChange (source, args) {
    this.queuePhysicsWorldChange('update', source, ['rescale', args])
  },
  physicsObjectMatrixChange (source, args) {
    // Handle troika-provided matrix (position and orientation) changes.
    // Applies to physics objects with zero mass (Kinematics-only objects),
    // and those that may not be under control of the dynamics world yet
    this.queuePhysicsWorldChange('update', source, ['worldMatrixChange', args])
  },
  physicsObjectDisabledChange (source, isDisabled) {
    if (isDisabled) {
      source.$isControlledByDynamicsWorld = false
      delete this._physicsObjectFacadesById[source.$facadeId]
      this.queuePhysicsWorldChange('remove', source)
    } else {
      this._physicsObjectFacadesById[source.$facadeId] = source
      this.queuePhysicsWorldChange('add', source)
    }
  },
  physicsObjectConfigChange (source, args) {
    this.queuePhysicsWorldChange('update', source, ['configChange', args])
  }
  // updatePhysicsShape (source, shapeMethodConfig) {
  //   const facadeId = source.$facadeIdå
  //   this.sendToWorker('updatePhysicsShape', [facadeId, shapeMethodConfig])
  // }
}
