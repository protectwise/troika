/* eslint-env worker */
/* eslint-disable new-cap */

export default function getAmmoPhysicsEngine (Thenable, Ammo, CONSTANTS, utils, shapeManager, AmmoDebugDrawer) {
  const {
    MSG_HDR_SZ,
    MSG_TYPES,
    MSG_ITEM_SIZES
  } = CONSTANTS

  const _sharedTransform = new Ammo.btTransform()
  const _sharedVec3A = new Ammo.btVector3()
  const _sharedVec3B = new Ammo.btVector3()
  const _sharedQuat = new Ammo.btQuaternion()
  let _sharedVecRef = null

  return class AmmoPhysicsEngine {
    constructor (options = {}) {
      // Transferrable objects resized in chunkSize steps
      this._chunkSz = options.chunkSize || 50 // options.reportsize || 50;

      // Initialize Transferable output arrays at initial chunk sized
      // [<message id>, <number of items in payload>, ...payload]
      this._rigidOutput = new Float32Array(MSG_HDR_SZ + this._chunkSz * MSG_ITEM_SIZES.RIGID)
      this._collisionOutput = new Float32Array(MSG_HDR_SZ + this._chunkSz * MSG_ITEM_SIZES.COLLISION)
      this._vehicleOutput = new Float32Array(MSG_HDR_SZ + this._chunkSz * MSG_ITEM_SIZES.VEHICLE)
      this._constraintOutput = new Float32Array(MSG_HDR_SZ + this._chunkSz * MSG_ITEM_SIZES.CONSTRAINT)
      this._softOutput = new Float32Array(MSG_HDR_SZ + this._chunkSz * MSG_ITEM_SIZES.SOFT)

      this._rigidOutput[0] = MSG_TYPES.RIGID_OUTPUT
      this._collisionOutput[0] = MSG_TYPES.COLLISION_OUTPUT
      this._vehicleOutput[0] = MSG_TYPES.VEHICLE_OUTPUT
      this._constraintOutput[0] = MSG_TYPES.CONSTRAINT_OUTPUT
      this._softOutput[0] = MSG_TYPES.SOFT_OUTPUT

      // this._nextBodyId = 0 // numeric index ID
      this._bodies = {
        rigid: {},
        soft: {},
        collisionObj: {} // More generic collisionObjects
      }
      this._bodyCounts = {
        rigid: 0,
        soft: 0,
        collisionObj: 0
      }
      this._bodyIdsToFacadeIds = {}
      this._facadeIdsToBodyIds = {}
      this._facadeIdsToBodyTypes = {}
      this._facadeIdsToPhysicsConfigs = Object.create(null)

      this.softBodyHelpers = null
      this.physicsWorld = null

      if (!shapeManager) {
        throw new Error('AmmoPhysicsEngine requires a shapeManager')
      }

      this._publicMethods = {
        updatePhysicsWorld: this.updatePhysicsWorld.bind(this),
        updateDebugOptions: this.updateDebugOptions.bind(this)
      }

      this._init()

      if (options.enableDebugger) {
        this._initDebug()
      }
    }

    _init () {
      // Physics configuration
      const collisionConfiguration = new Ammo.btSoftBodyRigidBodyCollisionConfiguration()
      const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration)
      const broadphase = new Ammo.btDbvtBroadphase()
      const solver = new Ammo.btSequentialImpulseConstraintSolver()
      const softBodySolver = new Ammo.btDefaultSoftBodySolver()

      this.physicsWorld = new Ammo.btSoftRigidDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration, softBodySolver)

      _sharedVec3A.setValue(0, CONSTANTS.DEFAULT_GRAVITY, 0)
      // this.physicsWorld.setGravity(new Ammo.btVector3(0, CONSTANTS.DEFAULT_GRAVITY, 0))
      this.physicsWorld.setGravity(_sharedVec3A)
      // this.physicsWorld.getWorldInfo().set_m_gravity(new Ammo.btVector3(0, CONSTANTS.DEFAULT_GRAVITY, 0))
      this.physicsWorld.getWorldInfo().set_m_gravity(_sharedVec3A)

      this.softBodyHelpers = new Ammo.btSoftBodyHelpers()
    }

    _initDebug () {
      this.debugDrawer = new AmmoDebugDrawer(this.physicsWorld)
      this.debugDrawer.enabled = true

      // this.debugDrawer.setDebugMode(128)
      // setInterval(() => {
      //   var mode = (this.debugDrawer.getDebugMode() + 1) % 3
      //   // console.log(`~~ cycle to mode`, mode)

      //   this.debugDrawer.setDebugMode(mode)
      // }, 1000)
    }

    _addBodyToIndices (facadeId, physicsBodyId, physicsBody, bodyType) {
      if (!bodyType) {
        throw new Error('bodyType is required')
      }
      // Set indexes/keys
      // const bodyId = this._nextBodyId++
      physicsBody.setUserIndex(physicsBodyId)

      // physicsBody.setUserPointer({facadeId})
      this._bodyIdsToFacadeIds[physicsBodyId] = facadeId
      this._facadeIdsToBodyIds[facadeId] = physicsBodyId
      this._facadeIdsToBodyTypes[facadeId] = bodyType

      this._bodies[bodyType][facadeId] = physicsBody
      this._bodyCounts[bodyType] += 1
    }

    // https://pybullet.org/Bullet/BulletFull/classbtCollisionObject.html
    // Add a generic collision object. Only used initially to
    // handle static/kinematic bvhTriangleMesh objects
    _addCollisionObject (facadeId, bodyId, bodyConfig) {
      const {
        shapeConfig,
        physicsConfig,
        initialMatrixWorld
      } = bodyConfig

      const physicsShape = shapeManager.getShape(shapeConfig)

      // var transform = new Ammo.btTransform()
      // transform.setIdentity()
      _sharedTransform.setFromOpenGLMatrix(initialMatrixWorld)
      // transform.setOrigin(new Ammo.btVector3(initialPos.x, initialPos.y, initialPos.z))
      // transform.setRotation(new Ammo.btQuaternion(initialQuat.x, initialQuat.y, initialQuat.z, initialQuat.w))

      var collisionObject = new Ammo.btBvhTriangleMeshShape()
      collisionObject.setCollisionShape(physicsShape)

      // if (isKinematic) {
      //   utils.setKinematic(collisionObject, true)
      // }

      this._addBodyToIndices(facadeId, bodyId, collisionObject, 'collisionObj')

      this.physicsWorld.addCollisionObject(collisionObject)
    }

    // https://pybullet.org/Bullet/BulletFull/classbtRigidBody.html
    _addRigidBody (facadeId, bodyId, bodyConfig) {
      const {
        shapeConfig,
        physicsConfig,
        initialMatrixWorld
        // initialPos,
        // initialQuat
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

      // var transform = new Ammo.btTransform()
      // transform.setIdentity()
      // transform.setOrigin(new Ammo.btVector3(initialPos.x, initialPos.y, initialPos.z))
      // transform.setRotation(new Ammo.btQuaternion(initialQuat.x, initialQuat.y, initialQuat.z, initialQuat.w))

      // var transform = new Ammo.btTransform()
      // transform.setIdentity()
      _sharedTransform.setFromOpenGLMatrix(initialMatrixWorld)
      // transform.setOrigin(new Ammo.btVector3(initialPos.x, initialPos.y, initialPos.z))
      // transform.setRotation(new Ammo.btQuaternion(initialQuat.x, initialQuat.y, initialQuat.z, initialQuat.w))

      var motionState = new Ammo.btDefaultMotionState(_sharedTransform)

      _sharedVec3A.setValue(0, 0, 0) // localInertia
      physicsShape.calculateLocalInertia(mass, _sharedVec3A)
      var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, physicsShape, _sharedVec3A)
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

      this._addBodyToIndices(facadeId, bodyId, rigidBody, 'rigid')

      this.physicsWorld.addRigidBody(rigidBody)

      // rigidBody.activate()
    }

    _addSoftBody (facadeId, bodyId, bodyConfig) {
      const {
        shapeConfig,
        physicsConfig
      } = bodyConfig
      const {
        vertices,
        indices,
        numTris
      } = shapeConfig
      const {
        mass = 1,
        pressure = 100,
        friction = 0.1,
        damping = 0.01
      } = physicsConfig

      const softBody = this.softBodyHelpers.CreateFromTriMesh(
        this.physicsWorld.getWorldInfo(),
        vertices, // vertices
        indices, // triangles
        numTris, // nTriangles
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

      this._addBodyToIndices(facadeId, bodyId, softBody, 'soft')

      // Disable deactivation
      softBody.setActivationState(4)

      this.physicsWorld.addSoftBody(softBody, 1, -1)
    }

    add (facadeId, bodyConfig) {
      const bodyId = bodyConfig.bodyId
      const {
        isSoftBody = false
      } = bodyConfig.physicsConfig

      // BVH tri-mesh (static or kinematic only) may be a concave mesh, and
      // are incompatible with RigidBody's dynamic extensions.
      const isGenericCollisionObject = bodyConfig.shapeConfig.type === 'bvh-tri-mesh'

      if (isGenericCollisionObject) {
        this._addCollisionObject(facadeId, bodyId, bodyConfig)
      } else if (isSoftBody) {
        this._addSoftBody(facadeId, bodyId, bodyConfig)
      } else {
        this._addRigidBody(facadeId, bodyId, bodyConfig)
      }

      this._facadeIdsToPhysicsConfigs[facadeId] = bodyConfig.physicsConfig
    }

    remove (facadeId) {
      const bodyType = this._facadeIdsToBodyTypes[facadeId]
      const body = this._bodies[bodyType][facadeId]
      this._bodyCounts[bodyType] -= 1

      if (bodyType === 'collisionObj') {
        this.physicsWorld.removeCollisionObject(body)
      } else if (bodyType === 'soft') {
        this.physicsWorld.removeSoftBody(body)
      } else if (bodyType === 'rigid') {
        this.physicsWorld.removeRigidBody(body)
      }

      // shapeManager.objectRemoved()
      const bodyId = this._facadeIdsToBodyIds[facadeId]
      delete this._bodyIdsToFacadeIds[bodyId]
      delete this._facadeIdsToBodyIds[facadeId]
      delete this._facadeIdsToBodyTypes[facadeId]
      delete this._facadeIdsToPhysicsConfigs[facadeId]
      delete this._bodies[bodyType][facadeId]
    }

    update (facadeId, updateData) {
      const bodyType = this._facadeIdsToBodyTypes[facadeId]
      const body = this._bodies[bodyType][facadeId]

      if (!body) {
        console.warn('update: body not found:', facadeId, bodyId, bodyType)
        return
      }

      // Note that these updates are applied in deliberate order
      if (updateData.scale) {
        utils.rescaleCollisionShape(body, updateData.scale)
      }
      if (updateData.matrix) {
        if (bodyType === 'soft') {
          console.log('~~ TODO handle troika matrix change for soft body.')
          // TODO, just setWorldTransform on SoftBody? will that clear out vertex motion states?
        } else if (bodyType === 'rigid') {
          utils.updateRigidBodyMatrix(body, updateData.matrix)
        } else if (bodyType === 'collisionObj') {
          console.warn('Generic collisionObjects do not have a motion state. Parent matrix changes may produce undesirable results.')
        }
      }
      if (updateData.physicsConfig) {
        const prevConfig = this._facadeIdsToPhysicsConfigs[facadeId]
        utils.updatePhysicsConfig(body, updateData.physicsConfig, prevConfig)
      }
    }

    setActivationState (facadeId, isPaused) {
      const forceSleep = true // If true, will still passively collide with other bodies
      const bodyType = this._facadeIdsToBodyTypes[facadeId]
      const body = this._bodies[bodyType][facadeId]
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

    sendDebugInfo () {
      const didUpdate = this.debugDrawer.update()
      if (didUpdate) {
        // Only transfer if the drawer had control of the payload and wrote to it
        this._transfer(this.debugDrawer.getTxOutput())
      }
    }

    sendRigidBodies () {
      const numRigidBodies = this._bodyCounts.rigid

      // Resize transferrable array if required
      if (this._rigidOutput.length < 2 + numRigidBodies * MSG_ITEM_SIZES.RIGID) {
        this._rigidOutput = new Float32Array(MSG_HDR_SZ + (Math.ceil(numRigidBodies / this._chunkSz) * this._chunkSz) * MSG_ITEM_SIZES.RIGID)
        this._rigidOutput[0] = MSG_TYPES.RIGID_OUTPUT
      }

      this._rigidOutput[1] = numRigidBodies // Update payload size

      let i = 0
      for (const facadeId in this._bodies.rigid) {
        const physicsBody = this._bodies.rigid[facadeId]
        const bodyId = this._facadeIdsToBodyIds[facadeId]

        // Only update motionState for active (activationState) bodies
        if (physicsBody.isActive()) {
          const motionState = physicsBody.getMotionState()

          if (motionState) {
            const offset = MSG_HDR_SZ + (i++) * MSG_ITEM_SIZES.RIGID
            // facadeOutput = new Array(8)
            this._rigidOutput[offset + 0] = bodyId // facadeId
            motionState.getWorldTransform(_sharedTransform)
            var pos = _sharedTransform.getOrigin()
            this._rigidOutput[offset + 1] = pos.x()
            this._rigidOutput[offset + 2] = pos.y()
            this._rigidOutput[offset + 3] = pos.z()
            var quat = _sharedTransform.getRotation()
            this._rigidOutput[offset + 4] = quat.x()
            this._rigidOutput[offset + 5] = quat.y()
            this._rigidOutput[offset + 6] = quat.z()
            this._rigidOutput[offset + 7] = quat.w()

            _sharedVecRef = physicsBody.getLinearVelocity()
            this._rigidOutput[offset + 8] = _sharedVecRef.x()
            this._rigidOutput[offset + 9] = _sharedVecRef.y()
            this._rigidOutput[offset + 10] = _sharedVecRef.z()

            _sharedVecRef = physicsBody.getAngularVelocity()
            this._rigidOutput[offset + 11] = _sharedVecRef.x()
            this._rigidOutput[offset + 12] = _sharedVecRef.y()
            this._rigidOutput[offset + 13] = _sharedVecRef.z()
          }
        }
      }

      // console.log(`> Rigid`)
      
      this._transfer(this._rigidOutput)
    }

    _transfer (payload /* Float32Array */) {
      if (!payload.buffer) {
        throw new Error('_transfer is only for Transferable Typed Arrays')
      }
      if (payload.buffer.byteLength === 0) {
        // throw new Error('PhysicsManager: Transferable Array has zero byte length')
        console.warn('AmmoPhysicsEngine: Transferable array has zero byte length, it may still be in-use in the main thread.')
        return
      }
      self.postMessage(payload.buffer, [payload.buffer])
    }

    handleChanges (payload) {
      if (payload.remove) {
        payload.remove.forEach(facadeId => {
          this.remove(facadeId)
        })
      }
      if (payload.add) {
        payload.add.forEach(facadeCfg => {
          this.add(facadeCfg.facadeId, facadeCfg)
        })
      }
      if (payload.update) {
        payload.update.forEach(facadeCfg => {
          this.update(facadeCfg.facadeId, facadeCfg)
        })
      }
    }

    updateDebugOptions (debugOptions) {
      if (this.debugDrawer) {
        this.debugDrawer.enabled = debugOptions.enabled || false
        // TODO support switching to other debugger modes
      }
    }

    updatePhysicsWorld (deltaTimeSec, changes) {
      if (changes) {
        this.handleChanges(changes)
      }

      this.physicsWorld.stepSimulation(deltaTimeSec, 10)

      // if (_vehicles.length > 0) {
      //   reportVehicles()
      // }
      // reportCollisions();
      // if (_constraints.length > 0) {
      //   reportConstraints()
      // }
      this.sendRigidBodies()
      
      // if (_softbody_enabled) {
      //   reportWorld_softbodies()
      // }

      if (this.debugDrawer) {
        this.sendDebugInfo()
      }

      return

      // const debugDrawerOutput = this.debugDrawer ? this._getDebugDrawerOutput() : null

      const softBodyOutput = [] // new Float32Array()

      // Update soft volumes
      for (const facadeId in this._bodies.soft) {
        const physicsBody = this._bodies.soft[facadeId]

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
        collisions: collisionsOutput,
        debugDrawerOutput: debugDrawerOutput
      }
    }

    receiveMessage (event) {
      let { data } = event

      if (data instanceof ArrayBuffer) {
        data = new Float32Array(data)
      }

      if (data instanceof Float32Array) {
        // Transferable object returned from main thread
        switch (data[0]) {
          case MSG_TYPES.RIGID_OUTPUT:
            this._rigidOutput = data // new Float32Array(data)
            break
          // case MSG_TYPES.COLLISION_OUTPUT:
          //   this._collisionOutput = new Float32Array(data)
          //   break
          // case MSG_TYPES.VEHICLE_OUTPUT:
          //   this._vehicleOutput = new Float32Array(data)
          //   break
          // case MSG_TYPES.CONSTRAINT_OUTPUT:
          //   this._constraintOutput = new Float32Array(data)
          //   break
          // case MSG_TYPES.SOFT_OUTPUT:
          //   this._softOutput = new Float32Array(data)
          //   break
          case MSG_TYPES.DEBUG_OUTPUT:
            this.debugDrawer.handleTxReturn(data)
            break
          default:
            console.error('UNRECOGNIZED returned transferable payload')
            break
        }
      } else if (data.method) {
        const { method, args = [] } = data
        if (this._publicMethods[method]) {
          this._publicMethods[method](...(args || []))
        } else {
          console.error(`Invalid method passed: ${method}`)
        }
      } else {
        console.error('Unknown message received', event)
      }
    }
  }
}
