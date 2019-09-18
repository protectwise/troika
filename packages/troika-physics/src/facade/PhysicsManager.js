import { Clock } from 'three'
import { utils } from 'troika-core'
import { Group3DFacade } from 'troika-3d'
// import { getTransitionPropInterceptorFactory } from 'troika-core/src/facade/getPropInterceptorFactory'

const { assign, assignIf } = utils

class CollisionEvent {
  constructor (eventType, target, collisionTarget, contacts, extraProps) {
    this.target = target
    this.collisionTarget = collisionTarget
    // More ergonomic contact shapes
    this.collisionContacts = contacts && contacts.map(contact => {
      const [targetXYZ, sourceXYZ, normalXYZ, impulse, force] = contact

      return {
        // World-space position of contact on the receiving object (Object A)
        targetXYZ,
        // World-space position of contact on the colliding object (Object B)
        sourceXYZ,
        // World-space normal vector
        // The normal is pointing from Object B towards Object A. // https://pybullet.org/Bullet/phpBB3/viewtopic.php?t=6620
        normalXYZ,
        impulse, // N•s
        force // N
      }
    })
    this.type = eventType
    assign(this, extraProps)
  }
}

export class PhysicsManager extends Group3DFacade {
  constructor (parent) {
    super(parent)

    // Separate cache of only physics-enabled facades
    // TODO use the prototype/parent's _object3DFacadesById cache and filter after?
    this._physicsObjectFacadesById = Object.create(null)

    this._workerReady = false
    this._needsPhysicsWorldUpdate = true

    this.clock = new Clock()

    this._initPhysicsWorld()

    this.addEventListener('beforerender', this.handleBeforeRender.bind(this))
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

  // Manager props
  // get simulationEnabled() {
  //   return this.simulationEnabled
  // }

  // set simulationEnabled (isEnabled) {
  //   if (isEnabled) {

  //   }
  // }

  _initPhysicsWorld () {
    this.physicsWorker = new Worker('node_modules/troika-physics/src/worker/physicsWorld.worker.js')

    this.physicsWorker.onmessage = this._handleWorkerMessage.bind(this)
    this.physicsWorker.onerror = function (err) {
      console.error(`Worker onError`, err)
    }

    // this.sendToWorker('init', [document.location.origin])
    this.physicsWorker.postMessage({
      method: 'init',
      args: [document.location.origin]
    })
  }

  _handleWorkerMessage (message) {
    const msgData = message.data
    switch (msgData.type) {
      case 'ready':
        this._workerReady = true
        this.afterUpdate() // Allow world startup

        // this.doRender()
        break
      case 'physicsWorldUpdated':
        if (msgData.rigidBodies) {
          this.handleRigidBodiesUpdated(msgData.rigidBodies)
        }
        if (msgData.collisions) {
          this.handleCollisionsUpdated(msgData.collisions)
        }
        break
      default:
        console.warn(`~~ Unhandled workerMessage`, message)
        break
    }
  }

  sendToWorker (method, args) {
    if (!this._workerReady) {
      // TODO Buffer messages?
      console.error(`~~ sendToWorker before ready!`, method, args)
      return
    }
    if (this.physicsWorker) {
      this.physicsWorker.postMessage({
        method,
        args
      })
    }
  }

  handleRigidBodiesUpdated (rigidBodies) {
    for (let i = 0, iLen = rigidBodies.length; i < iLen; i++) {
      // const facade = rigidBodies[i]
      const [facadeId, px, py, pz, qx, qy, qz, qw] = rigidBodies[i]
      const facade = this._physicsObjectFacadesById[facadeId]
      if (facade && !facade.physics.isKinematic) {
        
        facade.$isControlledByDynamicsWorld = true

        facade.threeObject.position.set( px, py, pz )
        facade.threeObject.quaternion.set( qx, qy, qz, qw )
        
        if (!facade._matrixChanged) {
          facade._matrixChanged = true
        }
        facade.afterUpdate.call(facade)
      } else {
        // console.error('Facade not found:', facadeId)
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

  handleBeforeRender () {
    var deltaTime = this.clock.getDelta()

    if (this._workerReady) {
      if (this._needsPhysicsWorldUpdate) {
        this._needsPhysicsWorldUpdate = false
        this._updatePhysicsWorld()
      }
      if (this.simulationEnabled) {
        this.sendToWorker('updatePhysicsWorld', [deltaTime])
      }
    }
  }

  // FIXME should this attempt to force the parent world into continuousRender mode?

  destructor () {
    if (this.physicsWorker) {
      this.physicsWorker.terminate()
      delete this.physicsWorker
      this._workerReady = false
    }
    for (const facadeId in this._physicsObjectFacadesById) {
      const facade = this._physicsObjectFacadesById[facadeId]
      facade.$isControlledByDynamicsWorld = false // relenquish physics control of pos/rot props
    }
    super.destructor()
  }

  _queuePhysicsWorldChange (changeType, facade, args) {
    // console.log(`~~ _queuePhysicsWorldChange`, changeType, facade, args)

    const changes = this._physicsBodyChangeset || (this._physicsBodyChangeset = {})
    const map = changes[changeType] || (changes[changeType] = Object.create(null))
    if (changeType === 'update') {
      // Updates are merged/batched for a particular facade
      // Update values are a nested map of change requests, keyed by
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
    this._needsPhysicsWorldUpdate = true // Flag for an update next render
  }

  _updatePhysicsWorld () {
    // console.log(`~~ _updatePhysicsWorld`, this._physicsBodyChangeset)

    // update worker physics world with any changed physics-enabled descendant facades
    const changes = this._physicsBodyChangeset
    if (changes) {
      const {
        remove,
        add,
        update
      } = changes

      if (remove) {
        for (const facadeId in remove) {
          this.sendToWorker('removeRigidBody', [facadeId])
          // const facade = this._physicsObjectFacadesById[facadeId]
          // facade.$isControlledByDynamicsWorld = false // Reset flag so regular props regain control
          // delete this._physicsObjectFacadesById[facadeId]
        }
      }
      if (add) {
        for (const facadeId in add) {
          // Check for add requests for objects that are now obsolete
          const facade = this._physicsObjectFacadesById[facadeId]
          if (facade && !facade.isDestroying && !(remove && remove[facadeId])) {
            // Get the facade's current current physics config.
            // This is needed in case pos/quat values have been updated since the facade was registered
            const pos = facade.threeObject.position
            const quat = facade.threeObject.quaternion
            const currentBodyConfig = {
              shapeConfig: facade._physicsShapeCfg,
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

            if (currentBodyConfig) {
              this.sendToWorker('addRigidBody', [facadeId, currentBodyConfig])
            } else {
              this.sendToWorker('removeRigidBody', [facadeId])
            }
          }
        }
      }
      if (update) {
        // Single batched update request
        this.sendToWorker('batchedBodyUpdates', [update]) // FIXME finish
      }
      this._physicsBodyChangeset = null
    }
  }
}

PhysicsManager.prototype._notifyWorldHandlers = {
  physicsObjectAdded (source) {
    // console.log(`~~ physicsObjectAdded`)

    this._physicsObjectFacadesById[source.$facadeId] = source
    this._queuePhysicsWorldChange('add', source)
  },
  physicsObjectRemoved (source) {
    source.$isControlledByDynamicsWorld = false
    delete this._physicsObjectFacadesById[source.$facadeId]
    this._queuePhysicsWorldChange('remove', source)
  },
  physicsObjectScaleChange (source, args) {
    this._queuePhysicsWorldChange('update', source, ['rescale', args])
  },
  physicsObjectMatrixChange (source, args) {
    // Handle troika-provided matrix (position and orientation) changes.
    // Applies to physics objects with zero mass (Kinematics-only objects),
    // and those that may not be under control of the dynamics world yet
    this._queuePhysicsWorldChange('update', source, ['worldMatrixChange', args])
  },
  physicsObjectDisabledChange (source, isDisabled) {
    if (isDisabled) {
      source.$isControlledByDynamicsWorld = false
      delete this._physicsObjectFacadesById[source.$facadeId]
      this._queuePhysicsWorldChange('remove', source)
    } else {
      this._physicsObjectFacadesById[source.$facadeId] = source
      this._queuePhysicsWorldChange('add', source)
    }
  },
  physicsObjectPausedChange (source, isPaused) {
    const facadeId = source.$facadeId
    this.sendToWorker('setBodyActivationState', [facadeId, isPaused])
  },
  updatePhysicsShape (source, shapeMethodConfig) {
    const facadeId = source.$facadeId

    this.sendToWorker('updatePhysicsShape', [facadeId, shapeMethodConfig])
  }
}