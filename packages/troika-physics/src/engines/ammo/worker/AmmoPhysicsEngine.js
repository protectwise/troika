/* eslint-env worker */
/* eslint-disable new-cap */

export default function getAmmoPhysicsEngine (Thenable, Ammo, CONSTANTS, utils, shapeManager) {
  return class AmmoPhysicsEngine {
    constructor (params) {
      this._nextBodyId = 0 // numeric index ID
      this._rigidBodies = {}
      this._softBodies = {}
      this._bodyIdsToFacadeIds = {}
      this._facadeIdsToBodyIds = {}
      this._facadeIdsToPhysicsConfigs = Object.create(null)

      this.softBodyHelpers = null
      this.physicsWorld = null

      this._sharedTransform = null

      if (!shapeManager) {
        throw new Error('AmmoPhysicsEngine requires a shapeManager')
      }

      this._init()
    }

    _init () {
    // Physics configuration
      const collisionConfiguration = new Ammo.btSoftBodyRigidBodyCollisionConfiguration()
      const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration)
      const broadphase = new Ammo.btDbvtBroadphase()
      const solver = new Ammo.btSequentialImpulseConstraintSolver()
      const softBodySolver = new Ammo.btDefaultSoftBodySolver()

      this.physicsWorld = new Ammo.btSoftRigidDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration, softBodySolver)

      this.physicsWorld.setGravity(new Ammo.btVector3(0, CONSTANTS.DEFAULT_GRAVITY, 0))
      this.physicsWorld.getWorldInfo().set_m_gravity(new Ammo.btVector3(0, CONSTANTS.DEFAULT_GRAVITY, 0))

      this._sharedTransform = new Ammo.btTransform()

      this.softBodyHelpers = new Ammo.btSoftBodyHelpers()
    }

    _addBodyToIndices (facadeId, physicsBody, isSoftBody) {
    // Set indexes/keys
      const bodyId = this._nextBodyId++
      physicsBody.setUserIndex(bodyId)

      // physicsBody.setUserPointer({facadeId})
      this._bodyIdsToFacadeIds[bodyId] = facadeId
      this._facadeIdsToBodyIds[facadeId] = bodyId

      if (isSoftBody) {
        this._softBodies[facadeId] = physicsBody
      } else {
        this._rigidBodies[facadeId] = physicsBody
      }
    }

    // https://pybullet.org/Bullet/BulletFull/classbtRigidBody.html
    _addRigidBody (facadeId, bodyConfig) {
      const {
        shapeConfig,
        physicsConfig,
        initialPos,
        initialQuat
      } = bodyConfig
      const {
        friction,
        restitution,
        // isDisabled = false,
        isKinematic = false,
        isStatic = false
      } = physicsConfig

      let mass = physicsConfig.mass

      if (isStatic || isKinematic) {
        mass = 0 // Override any user-set mass
      }

      const physicsShape = shapeManager.getShape(shapeConfig)

      var transform = new Ammo.btTransform()
      transform.setIdentity()
      transform.setOrigin(new Ammo.btVector3(initialPos.x, initialPos.y, initialPos.z))
      transform.setRotation(new Ammo.btQuaternion(initialQuat.x, initialQuat.y, initialQuat.z, initialQuat.w))

      var motionState = new Ammo.btDefaultMotionState(transform)

      var localInertia = new Ammo.btVector3(0, 0, 0)
      physicsShape.calculateLocalInertia(mass, localInertia)
      var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, physicsShape, localInertia)
      var rigidBody = new Ammo.btRigidBody(rbInfo)

      if (isKinematic) {
        utils.setKinematic(rigidBody, true)
      }

      /*
    // TODO evaluate if we need this. Expose `initialActivationState` with default?
    if (mass > 0) {
      Disable deactivation
      utils.disableDeactivation(rigidBody)
    }
    */

      if (friction) {
        rigidBody.setFriction(friction)
      }
      if (restitution) {
        rigidBody.setRestitution(restitution)
      }

      this._addBodyToIndices(facadeId, rigidBody, false)

      this.physicsWorld.addRigidBody(rigidBody)
    }

    _addSoftBody (facadeId, bodyConfig) {
      const {
        shapeConfig,
        physicsConfig
      } = bodyConfig
      const {
        volumeVertices,
        volumeIndices
      // numNodes
      } = shapeConfig
      const {
        mass = 1,
        pressure = 100,
        friction = 0.1,
        damping = 0.01
      } = physicsConfig

      const softBody = this.softBodyHelpers.CreateFromTriMesh(
        this.physicsWorld.getWorldInfo(),
        volumeVertices, // vertices
        volumeIndices, // triangles
        volumeIndices.length / 3, // nTriangles
        true // randomizeConstraints
      )

      // NOTE: see README for details on Soft Body Config.
      // Also see commented source here: https://pybullet.org/Bullet/BulletFull/btSoftBody_8h_source.html
      const sbConfig = softBody.get_m_cfg()
      sbConfig.set_viterations(40)
      sbConfig.set_piterations(40)

      // Soft-soft and soft-rigid collisions
      sbConfig.set_collisions(0x11)

      sbConfig.set_kDF(friction) // Dynamic friction coefficient [0,1]
      sbConfig.set_kDP(damping) // Damping coefficient [0,1]
      sbConfig.set_kPR(pressure) // Pressure coefficient [-inf,+inf]

      // sbConfig.set_kCHR(0.99) // Rigid contacts hardness [0,1]
      // sbConfig.set_kKHR(0.99) // Kinetic contacts hardness [0,1]
      // sbConfig.set_kSHR(0.99) // Soft contacts hardness [0,1]

      // sbConfig.set_kSRHR_CL(0.99) // Soft vs rigid hardness [0,1] (cluster only)
      // sbConfig.set_kSKHR_CL(0.99) // Soft vs kinetic hardness [0,1] (cluster only)
      // sbConfig.set_kSSHR_CL(0.99) // Soft vs soft hardness [0,1] (cluster only)

      // Stiffness
      softBody.get_m_materials().at(0).set_m_kLST(0.9) // Linear stiffness coefficient [0,1]
      softBody.get_m_materials().at(0).set_m_kAST(0.9) // Area/Angular stiffness coefficient [0,1]
      // softBody.get_m_materials().at(0).set_m_kVST(0.9) // Volume stiffness coefficient [0,1]

      softBody.setTotalMass(mass, false)

      /*
     *  Via http://www.cs.kent.edu/~ruttan/GameEngines/lectures/Bullet_User_Manual
     *
     *  By default, soft bodies perform collision detection using between vertices (nodes) and triangles (faces).
     *  This requires a dense tessellation, otherwise collisions might be missed. An improved method uses
     *  automatic decomposition into convex deformable clusters. To enable collision clusters, use:
     */
      softBody.generateClusters(3) // TODO make configurable. cluster generation not always required. Improved collision accuracy?

      Ammo.castObject(softBody, Ammo.btCollisionObject).getCollisionShape().setMargin(CONSTANTS.DEFAULT_MARGIN)

      this._addBodyToIndices(facadeId, softBody, true)

      // Disable deactivation
      softBody.setActivationState(4)

      this.physicsWorld.addSoftBody(softBody, 1, -1)
    }

    add (facadeId, bodyConfig) {
      const {
        isSoftBody = false
      } = bodyConfig.physicsConfig

      if (isSoftBody) {
        this._addSoftBody(facadeId, bodyConfig)
      } else {
        this._addRigidBody(facadeId, bodyConfig)
      }

      this._facadeIdsToPhysicsConfigs[facadeId] = bodyConfig.physicsConfig
    }

    remove (facadeId) {
      const isSoftBody = !!this._softBodies[facadeId]
      const body = isSoftBody ? this._softBodies[facadeId] : this._rigidBodies[facadeId]

      // const bodyShape = body.getCollisionShape()

      if (isSoftBody) {
        this.physicsWorld.removeSoftBody(body)
      } else {
        this.physicsWorld.removeRigidBody(body)
      }

      // shapeManager.objectRemoved()
      const bodyId = this._facadeIdsToBodyIds[facadeId]
      delete this._bodyIdsToFacadeIds[bodyId]
      delete this._facadeIdsToBodyIds[facadeId]
      delete this._facadeIdsToPhysicsConfigs[facadeId]
      delete this._softBodies[facadeId]
      delete this._rigidBodies[facadeId]
    }

    setActivationState (facadeId, isPaused) {
      const forceSleep = true // If true, will still passively collide with other bodies
      const body = this._rigidBodies[facadeId]
      const deactivatedState = forceSleep ? CONSTANTS.ACTIVATION_STATES.ISLAND_SLEEPING : CONSTANTS.ACTIVATION_STATES.DISABLE_SIMULATION
      const newActivationState = isPaused
        ? deactivatedState
        : CONSTANTS.DEFAULT_ACTIVATION_STATE
      body.forceActivationState(newActivationState)
    }

    // updatePhysicsShape (facadeId, shapeMethodConfig) {
    //   console.log(`~~ TODO still need this?`)

    //   //   const body = this._rigidBodies[facadeId]
    //   //   if (!body) {
    //   //     console.warn(`updatePhysicsShape: body not found`, facadeId, _rigidBodies)
    //   //     return
    //   //   }
    //   //   const collisionShape = body.getCollisionShape()

    //   //   const { method, args } = shapeMethodConfig
    //   //   const composedArgs = utils.recurComposeArgs(args || [])
    //   //   collisionShape[method](...composedArgs)

    //   //   // body.setCollisionShape(collisionShape)

    //   //   // if (method === 'setLocalScaling') {
    //   //   //   physicsWorld.updateSingleAABB(body)
    //   //   // }
    // }

    batchedUpdate (updateSet) {
      for (const facadeId in updateSet) {
        const facadeUpdates = updateSet[facadeId]
        const isSoftBody = !!this._softBodies[facadeId]
        const body = isSoftBody ? this._softBodies[facadeId] : this._rigidBodies[facadeId]
        if (!body) {
          console.warn('batchedUpdate: body not found:', facadeId, this._rigidBodies, this._softBodies)
          return
        }
        for (const updateType in facadeUpdates) {
          const updateArgs = facadeUpdates[updateType]

          switch (updateType) {
            case 'rescale':
              utils.rescaleCollisionShape(body, updateArgs)
              break
            case 'worldMatrixChange':
              if (isSoftBody) {
                console.log('~~ TODO handle troika matrix change for soft body.')
              // TODO, just setWorldTransform on SoftBody? will that clear out vertext motion states?
              } else {
                utils.updateRigidBodyMatrix(body, updateArgs)
              }
              break
            case 'configChange': {
              const prevConfig = this._facadeIdsToPhysicsConfigs[facadeId]
              utils.updatePhysicsConfig(body, updateArgs, prevConfig)
              break
            }
            default:
              console.warn('Unsupported batchBodyUpdate updateType', updateType)
              break
          }
        }
      }
    }

    _getCollisions (deltaTimeSec) {
      const output = []
      let collisionArr
      let contactsArr

      // https://pybullet.org/Bullet/phpBB3/viewtopic.php?f=9&t=1691&start=0
      const numManifolds = this.physicsWorld.getDispatcher().getNumManifolds()
      for (let i = 0; i < numManifolds; i++) {
        const contactManifold = this.physicsWorld.getDispatcher().getManifoldByIndexInternal(i)
        const bodyA = contactManifold.getBody0() // btCollisionObject
        const bodyB = contactManifold.getBody1() // btCollisionObject

        // TODO only output for events involving a body that has an onCollision event handler
        // FIXME use preallocated arrays or transferrables
        collisionArr = [
          this._bodyIdsToFacadeIds[bodyA.getUserIndex()], // bodyA facadeId
          this._bodyIdsToFacadeIds[bodyB.getUserIndex()] // bodyB facadeId
        // [] contactPoints
        ]

        // TODO only compute/return contact points if required?
        const numContacts = contactManifold.getNumContacts()
        contactsArr = []
        for (let j = 0; j < numContacts; j++) {
          const pt = contactManifold.getContactPoint(j) // btManifoldPoint
          const ptImpulse = pt.getAppliedImpulse() // N⋅s (Newton seconds)
          const ptForce = ptImpulse / deltaTimeSec // N (Newtons)
          const ptObA = pt.getPositionWorldOnA() // btVector3
          const psObB = pt.getPositionWorldOnB() // btVector3
          const ptNorm = pt.m_normalWorldOnB

          contactsArr.push([
            [ptObA.x(), ptObA.y(), ptObA.z()],
            [psObB.x(), psObB.y(), psObB.z()],
            [ptNorm.x(), ptNorm.y(), ptNorm.z()],
            ptImpulse,
            ptForce
          ])
        }
        if (contactsArr.length > 0) {
          collisionArr.push(contactsArr)
        }
        output.push(collisionArr)
      }

      return output
    }

    updatePhysicsWorld (deltaTimeSec) {
      this.physicsWorld.stepSimulation(deltaTimeSec, 10)

      const rigidBodyOutput = [] // new Float32Array()
      let facadeOutput

      // Update rigid bodies
      for (const facadeId in this._rigidBodies) {
        const physicsBody = this._rigidBodies[facadeId]

        // Only update motionState for active (activationState) bodies
        if (physicsBody.isActive()) {
          const motionState = physicsBody.getMotionState()

          if (motionState) {
            facadeOutput = new Array(8)
            facadeOutput[0] = facadeId
            motionState.getWorldTransform(this._sharedTransform)
            var pos = this._sharedTransform.getOrigin()
            facadeOutput[1] = pos.x()
            facadeOutput[2] = pos.y()
            facadeOutput[3] = pos.z()
            var quat = this._sharedTransform.getRotation()
            facadeOutput[4] = quat.x()
            facadeOutput[5] = quat.y()
            facadeOutput[6] = quat.z()
            facadeOutput[7] = quat.w()

            rigidBodyOutput.push(facadeOutput)
          }
        }
      }

      const softBodyOutput = [] // new Float32Array()

      // Update soft volumes
      for (const facadeId in this._softBodies) {
        const physicsBody = this._softBodies[facadeId]

        // Only update motionState for active (activationState) bodies
        if (physicsBody.isActive()) {
          facadeOutput = new Array(2) // [facadeId, [x1,y1,z1,nx1,ny1,nz1, x2,y2,z2,nx2,ny2,nz2, ...etc ]]
          facadeOutput[0] = facadeId
          const softBodyNodes = physicsBody.get_m_nodes()
          const numNodes = softBodyNodes.size()
          const flattenedDims = 6
          const nodesOutput = new Array(numNodes * flattenedDims)

          for (let i = 0; i < numNodes; i++) {
            const node = softBodyNodes.at(i)
            const nodePos = node.get_m_x()
            const di = flattenedDims * i
            nodesOutput[di + 0] = nodePos.x()
            nodesOutput[di + 1] = nodePos.y()
            nodesOutput[di + 2] = nodePos.z()
            const nodeNormal = node.get_m_n()
            nodesOutput[di + 3] = nodeNormal.x()
            nodesOutput[di + 4] = nodeNormal.y()
            nodesOutput[di + 5] = nodeNormal.z()
          }
          facadeOutput[1] = nodesOutput

          softBodyOutput.push(facadeOutput)
        }
      }

      // Get collision pairs
      const collisionsOutput = this._getCollisions(deltaTimeSec)

      return {
        rigidBodies: rigidBodyOutput,
        softBodies: softBodyOutput,
        collisions: collisionsOutput
      }
    }

    handleBodyChanges (bodyChanges) {
      if (bodyChanges.remove) {
        bodyChanges.remove.forEach(facadeId => {
          this.remove(facadeId)
        })
      }
      if (bodyChanges.add) {
        bodyChanges.add.forEach(facadeCfg => {
          this.add(facadeCfg.facadeId, facadeCfg)
        })
      }
      if (bodyChanges.update) {
        this.batchedUpdate(bodyChanges.update)
      }
    }

    update (requestPayload, callback) {
      const { updateDeltaTime, bodyChanges } = requestPayload
      let response = null
      if (bodyChanges) {
        // Changes performed synchronously
        this.handleBodyChanges(bodyChanges)
      }
      if (updateDeltaTime) {
        response = this.updatePhysicsWorld(updateDeltaTime)
      }

      callback(response)
    }
  }
}
