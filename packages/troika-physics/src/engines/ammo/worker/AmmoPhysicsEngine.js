/* eslint-env worker */
/* eslint-disable new-cap */

export default function getAmmoPhysicsEngine (Thenable, Ammo, CONSTANTS, AMMO_CONSTANTS, utils, shapeManager, AmmoDebugDrawer) {
  const {
    ACTIVATION_STATES,
    DEFAULT_ACTIVATION_STATE
  } = AMMO_CONSTANTS
  const {
    MSG_HDR_SZ,
    MSG_TYPES,
    RIGID_MSG_SIZE,
    SOFT_BODY_TYPE,
    SOFT_BODY_MSG_SIZES,
    CONTACT_SIZE,
    COLLISION_SIZE
  } = CONSTANTS
  const DEFAULT_SOFT_BODY_TYPE = SOFT_BODY_TYPE.TRIMESH

  const _sharedTransform = new Ammo.btTransform()
  const _sharedVec3A = new Ammo.btVector3()
  // const _sharedVec3B = new Ammo.btVector3()
  // const _sharedQuat = new Ammo.btQuaternion()
  let _sharedVecRef = null
  let _tempArr = []
  let _handledCollisionKeys = []

  return class AmmoPhysicsEngine {
    constructor (options = {}) {
      // Transferrable objects resized in chunkSize steps
      this._chunkSz = options.chunkSize || 50

      // Initialize Transferable output arrays at initial chunk sized
      // [<message id>, <number of items in payload>, ...payload]
      this._rigidOutput = new Float32Array(MSG_HDR_SZ)
      this._softOutput = new Float32Array(MSG_HDR_SZ)
      this._collisionOutput = new Float32Array(MSG_HDR_SZ)
      this._constraintOutput = new Float32Array(MSG_HDR_SZ)
      this._vehicleOutput = new Float32Array(MSG_HDR_SZ)

      this._rigidOutput[0] = MSG_TYPES.RIGID_OUTPUT
      this._softOutput[0] = MSG_TYPES.SOFT_OUTPUT
      this._collisionOutput[0] = MSG_TYPES.COLLISION_OUTPUT
      this._constraintOutput[0] = MSG_TYPES.CONSTRAINT_OUTPUT
      this._vehicleOutput[0] = MSG_TYPES.VEHICLE_OUTPUT

      this._softOutputMsgSize = 0

      this._bodies = {
        rigid: {},
        soft: {},
        collisionObj: {}
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
      this._bodiesWithListeners = []

      this._vehicles = []
      this._constraints = []

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
      const collisionConfiguration = new Ammo.btSoftBodyRigidBodyCollisionConfiguration()
      const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration)
      const broadphase = new Ammo.btDbvtBroadphase()
      const solver = new Ammo.btSequentialImpulseConstraintSolver()
      const softBodySolver = new Ammo.btDefaultSoftBodySolver()

      this.physicsWorld = new Ammo.btSoftRigidDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration, softBodySolver)

      _sharedVec3A.setValue(0, CONSTANTS.DEFAULT_GRAVITY, 0)
      this.physicsWorld.setGravity(_sharedVec3A)
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
      physicsBody.setUserIndex(physicsBodyId)

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
        initialMatrixWorld
      } = bodyConfig

      const physicsShape = shapeManager.getShape(shapeConfig)

      _sharedTransform.setFromOpenGLMatrix(initialMatrixWorld)

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
      } = bodyConfig
      const {
        friction,
        restitution,
        isKinematic = false,
        isStatic = false
      } = physicsConfig

      let mass = physicsConfig.mass

      if (isStatic || isKinematic) {
        mass = 0 // Override any user-set mass
      }

      const physicsShape = shapeManager.getShape(shapeConfig)

      _sharedTransform.setFromOpenGLMatrix(initialMatrixWorld)

      const motionState = new Ammo.btDefaultMotionState(_sharedTransform)

      _sharedVec3A.setValue(0, 0, 0) // localInertia
      physicsShape.calculateLocalInertia(mass, _sharedVec3A)
      const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, physicsShape, _sharedVec3A)
      const rigidBody = new Ammo.btRigidBody(rbInfo)

      if (isKinematic) {
        utils.setKinematic(rigidBody, true)
      }

      // TODO evaluate if we need this. Expose `initialActivationState` with default?
      // if (mass > 0) {
      //   utils.disableDeactivation(rigidBody)
      // }

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
        damping = 0.01,
        softBodyType = DEFAULT_SOFT_BODY_TYPE // 1=rope, 2=cloth, 3=everything else (volumes)
      } = physicsConfig

      let softBody
      switch (softBodyType) {
        case SOFT_BODY_TYPE.TRIMESH:
          softBody = this.softBodyHelpers.CreateFromTriMesh(
            this.physicsWorld.getWorldInfo(),
            vertices, // vertices
            indices, // triangles
            numTris, // nTriangles
            false // true // randomizeConstraints
          )
          break
        case SOFT_BODY_TYPE.CLOTH:
          console.warn('TODO cloth', vertices)
          break
        case SOFT_BODY_TYPE.ROPE: {
          const numVerts = vertices.length / 3
          const lastIdxBase = (numVerts - 1) * 3
          const middleNodeCt = numVerts - 2 // Number of vertices between the start and end

          softBody = this.softBodyHelpers.CreateRope(
            this.physicsWorld.getWorldInfo(),
            new Ammo.btVector3(
              vertices[0],
              vertices[1],
              vertices[2]
            ),
            new Ammo.btVector3(
              vertices[lastIdxBase],
              vertices[lastIdxBase + 1],
              vertices[lastIdxBase + 2]
            ),
            middleNodeCt,
            0 // FIXEDs 1: First node is fixed, 2: Last node Fixed, 3: Both are fixed
          )
          break
        }
        default:
          console.error('Unknown soft body type', softBodyType)
          break
      }

      // NOTE: see README for details on Soft Body Config.
      // Also see commented source here: https://pybullet.org/Bullet/BulletFull/btSoftBody_8h_source.html
      const sbConfig = softBody.get_m_cfg()
      sbConfig.set_viterations(40)
      sbConfig.set_piterations(40)

      sbConfig.set_collisions(0x11) // Soft-soft and soft-rigid collisions

      if (softBodyType !== SOFT_BODY_TYPE.ROPE) {
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
      } else {
        // TODO custom settings for rope?
        // sbConfig.set_viterations(10)
        // sbConfig.set_piterations(10)
      }

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

      switch (softBodyType) {
        case SOFT_BODY_TYPE.TRIMESH:
          this._softOutputMsgSize += SOFT_BODY_MSG_SIZES.HDR + (softBody.get_m_nodes().size() * SOFT_BODY_MSG_SIZES.TRIMESH)
          break
        case SOFT_BODY_TYPE.CLOTH:
          this._softOutputMsgSize += SOFT_BODY_MSG_SIZES.HDR + (softBody.get_m_nodes().size() * SOFT_BODY_MSG_SIZES.CLOTH)
          break
        case SOFT_BODY_TYPE.ROPE:
          this._softOutputMsgSize += SOFT_BODY_MSG_SIZES.HDR + (softBody.get_m_nodes().size() * SOFT_BODY_MSG_SIZES.ROPE)
          break
        default:
          break
      }
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
      const cfg = this._facadeIdsToPhysicsConfigs[facadeId]
      this._bodyCounts[bodyType] -= 1

      if (bodyType === 'collisionObj') {
        this.physicsWorld.removeCollisionObject(body)
      } else if (bodyType === 'soft') {
        switch (cfg.softBodyType || DEFAULT_SOFT_BODY_TYPE) {
          case SOFT_BODY_TYPE.TRIMESH:
            this._softOutputMsgSize -= SOFT_BODY_MSG_SIZES.HDR + (body.get_m_nodes().size() * SOFT_BODY_MSG_SIZES.TRIMESH)
            break
          case SOFT_BODY_TYPE.CLOTH:
            this._softOutputMsgSize -= SOFT_BODY_MSG_SIZES.HDR + (body.get_m_nodes().size() * SOFT_BODY_MSG_SIZES.CLOTH)
            break
          case SOFT_BODY_TYPE.ROPE:
            this._softOutputMsgSize -= SOFT_BODY_MSG_SIZES.HDR + (body.get_m_nodes().size() * SOFT_BODY_MSG_SIZES.ROPE)
            break
          default:
            break
        }
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
        console.warn('update: body not found:', facadeId, bodyType)
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
      const deactivatedState = forceSleep ? ACTIVATION_STATES.ISLAND_SLEEPING : ACTIVATION_STATES.DISABLE_SIMULATION
      const newActivationState = isPaused
        ? deactivatedState
        : DEFAULT_ACTIVATION_STATE
      body.forceActivationState(newActivationState)
    }

    // updatePhysicsShape (facadeId, shapeMethodConfig) {
    //   const body = this._rigidBodies[facadeId]
    //   if (!body) {
    //     return
    //   }
    //   const collisionShape = body.getCollisionShape()

    //   const { method, args } = shapeMethodConfig
    //   const composedArgs = utils.recurComposeArgs(args || [])
    //   collisionShape[method](...composedArgs)

    //   body.setCollisionShape(collisionShape)

    //   if (method === 'setLocalScaling') {
    //     physicsWorld.updateSingleAABB(body)
    //   }
    // }

    sendVehicles () {
      // TODO
    }

    /**
     * Send information about body collisions
     * Helpful threads:
     * - https://pybullet.org/Bullet/phpBB3/viewtopic.php?f=9&t=1691&start=0     *
     * - https://pybullet.org/Bullet/phpBB3/viewtopic.php?f=9&t=3997&start=15
     *   > It seems if you want to detect collisions between 'real' bodies -- do the contact manifold iteration. If you want to know about the amount of intrusion into a given space, then use an explicit collision query, possibly accelerated through use of a ghost object.
     *   > Only use btGhost acceleration if the query location is the same for at least a few frames, otherwise its pair caching isn't helping much.
     * 
     * - Iterating over all contact pairs is best for "real" (rendered) objects.
     * - Use `ghostObjects` (trigger volumes?) to improve performance for collisions with "static" things (like power-ups in a game)
     *
     * Note that the newer callback-based API (contactTest, contactPairTest) is in 2.76+
     * and not available in our Ammo/Bullet version (~2.73)
     * "Bullet 2.76 onwards let you perform an instant query on the world (btCollisionWorld or btDiscreteDynamicsWorld) using the contactTest query. The contactTest query will perform a collision test against all overlapping objects in the world, and produces the results using a callback."
     */
    sendCollisions (deltaTimeSec) {
      _handledCollisionKeys = [] // only output one collision between a given pair, since we emit the event for both anyway

      _tempArr = []

      const numManifolds = this.physicsWorld.getDispatcher().getNumManifolds()

      let offset = MSG_HDR_SZ

      for (let i = 0; i < numManifolds; i++) {
        const contactManifold = this.physicsWorld.getDispatcher().getManifoldByIndexInternal(i)
        const bodyA = contactManifold.getBody0() // btCollisionObject
        const bodyB = contactManifold.getBody1() // btCollisionObject
        const bodyAId = bodyA.getUserIndex() // bodyA physicsBodyId
        const bodyBId = bodyB.getUserIndex() // bodyB physicsBodyId

        const collisionKey = `${bodyAId}-${bodyBId}`

        const emitCollision = !_handledCollisionKeys[collisionKey] && (
          this._bodiesWithListeners.indexOf(bodyAId) !== -1 ||
          this._bodiesWithListeners.indexOf(bodyBId) !== -1
        )

        // TODO future optimization: only compute/return contact points if required.
        // - Add new event listener signature? i.e. `onCollisionContact`, or add options to `onCollision` somehow?
        const computeContacts = true // (this._bodiesWithListeners[bodyAId] === 2 || this._bodiesWithListeners[bodyAId] === 2)

        if (emitCollision) {
          _handledCollisionKeys.push(collisionKey)

          // Pre-fill with zeroes to eliminate NaNs in the transferrable output
          // TODO won't need this if we can preallocate a Float32Array with the right size up front
          _tempArr.length += COLLISION_SIZE
          _tempArr.fill(0, offset, offset + COLLISION_SIZE)

          _tempArr[offset + 0] = bodyAId
          _tempArr[offset + 1] = bodyBId
          _tempArr[offset + 2] = 0

          if (computeContacts) {
            /*
            * https://pybullet.org/Bullet/phpBB3/viewtopic.php?f=9&t=1691&start=0
            * > the contact points are available, each overlapping pair of objects has up to 4 points in a btPersistentContactManifold (=contact cache).
            */
            const numContacts = contactManifold.getNumContacts()
            _tempArr[offset + 2] = numContacts

            for (let j = 0; j < numContacts; j++) {
              const pt = contactManifold.getContactPoint(j) // btManifoldPoint
              const pointImpulse = pt.getAppliedImpulse() // N⋅s (Newton seconds)
              const pointForce = pointImpulse / deltaTimeSec // N (Newtons)
              const pointA = pt.getPositionWorldOnA() // btVector3
              const pointB = pt.getPositionWorldOnB() // btVector3
              const pointNormal = pt.m_normalWorldOnB

              const contactOffset = offset + 3 + (CONTACT_SIZE * j)
              _tempArr[contactOffset + 0] = pointA.x()
              _tempArr[contactOffset + 1] = pointA.y()
              _tempArr[contactOffset + 2] = pointA.z()

              _tempArr[contactOffset + 3] = pointB.x()
              _tempArr[contactOffset + 4] = pointB.y()
              _tempArr[contactOffset + 5] = pointB.z()

              _tempArr[contactOffset + 6] = pointNormal.x()
              _tempArr[contactOffset + 7] = pointNormal.y()
              _tempArr[contactOffset + 8] = pointNormal.z()

              _tempArr[contactOffset + 9] = pointImpulse
              _tempArr[contactOffset + 10] = pointForce
            }
          }

          offset += COLLISION_SIZE
        }
      }

      _tempArr[0] = MSG_TYPES.COLLISION_OUTPUT
      _tempArr[1] = _handledCollisionKeys.length // Update payload size

      // TODO find a way to preallocate a size for this so we don't have to recreate it each time (or use a temporary output array)
      this._collisionOutput = new Float32Array(_tempArr)

      this._transfer(this._collisionOutput)
    }

    sendConstraints () {
      // TODO
    }

    sendRigidBodies () {
      const numRigidBodies = this._bodyCounts.rigid

      const needsResize = this._rigidOutput.length < MSG_HDR_SZ + numRigidBodies * RIGID_MSG_SIZE
      if (needsResize) {
        this._rigidOutput = new Float32Array(MSG_HDR_SZ + (Math.ceil(numRigidBodies / this._chunkSz) * this._chunkSz) * RIGID_MSG_SIZE)
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
            const offset = MSG_HDR_SZ + (i++) * RIGID_MSG_SIZE
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

      this._transfer(this._rigidOutput)
    }

    sendSoftBodies () {
      const numSoftBodies = this._bodyCounts.soft

      // Recreate transferrable array if message length has changed
      const newLength = MSG_HDR_SZ + this._softOutputMsgSize
      if (this._softOutput.length !== newLength) {
        this._softOutput = new Float32Array(newLength)
        this._softOutput[0] = MSG_TYPES.SOFT_OUTPUT
      }

      this._softOutput[1] = numSoftBodies // Update payload size

      let offset = MSG_HDR_SZ

      for (const facadeId in this._bodies.soft) {
        const physicsBody = this._bodies.soft[facadeId]
        const bodyId = this._facadeIdsToBodyIds[facadeId]
        const cfg = this._facadeIdsToPhysicsConfigs[facadeId]
        const softBodyType = cfg.softBodyType || DEFAULT_SOFT_BODY_TYPE

        // Only update motionState for active (activationState) bodies
        if (physicsBody.isActive()) {
          this._softOutput[offset + 0] = bodyId // SOFT_BODY_MSG_SIZES.HDR[0]
          this._softOutput[offset + 1] = softBodyType // SOFT_BODY_MSG_SIZES.HDR[1]

          const offsetVert = offset + SOFT_BODY_MSG_SIZES.HDR

          switch (softBodyType) {
            case SOFT_BODY_TYPE.TRIMESH: // TODO if we update to Bullet 3+, use `m_faces` for triangle meshes. Currently it uses the same strategy as a 2d cloth
            case SOFT_BODY_TYPE.CLOTH: {
              const nodes = physicsBody.get_m_nodes()
              const size = nodes.size()
              this._softOutput[offset + 2] = size // SOFT_BODY_MSG_SIZES.HDR[2]

              for (let i = 0; i < size; i++) {
                const node = nodes.at(i)
                const vert = node.get_m_x()
                const normal = node.get_m_n()
                const off = offsetVert + (i * SOFT_BODY_MSG_SIZES.TRIMESH)

                this._softOutput[off + 0] = vert.x()
                this._softOutput[off + 1] = vert.y()
                this._softOutput[off + 2] = vert.z()

                this._softOutput[off + 3] = normal.x()
                this._softOutput[off + 4] = normal.y()
                this._softOutput[off + 5] = normal.z()
              }

              offset += SOFT_BODY_MSG_SIZES.HDR + (size * SOFT_BODY_MSG_SIZES.TRIMESH)
              break
            }
            case SOFT_BODY_TYPE.ROPE: {
              const nodes = physicsBody.get_m_nodes()
              const size = nodes.size()
              this._softOutput[offset + 2] = size // SOFT_BODY_MSG_SIZES.HDR[2]

              for (let i = 0; i < size; i++) {
                const node = nodes.at(i)
                const vert = node.get_m_x()
                const off = offsetVert + (i * SOFT_BODY_MSG_SIZES.ROPE)

                this._softOutput[off] = vert.x()
                this._softOutput[off + 1] = vert.y()
                this._softOutput[off + 2] = vert.z()
              }

              offset += SOFT_BODY_MSG_SIZES.HDR + (size * SOFT_BODY_MSG_SIZES.ROPE)

              break
            }
            default:
              break
          }
        }
      }

      this._transfer(this._softOutput)
    }

    sendDebugInfo () {
      const didUpdate = this.debugDrawer.update()
      if (didUpdate) {
        // Only transfer if the drawer had control of the payload and wrote to it
        this._transfer(this.debugDrawer.getTxOutput())
      }
    }

    _transfer (payload /* Float32Array */) {
      if (!payload.buffer) {
        throw new Error('_transfer is only for Transferable Typed Arrays')
      }
      if (payload.buffer.byteLength === 0) {
        console.warn('AmmoPhysicsEngine: Transferable array has zero byte length, it may still be in-use in the main thread.')
        return
      }
      self.postMessage(payload.buffer, [payload.buffer])
    }

    handleChanges (payload) {
      if (payload.listenerRemove) {
        payload.listenerRemove.forEach(facadeId => {
          const bodyId = this._facadeIdsToBodyIds[facadeId]
          const idx = this._bodiesWithListeners.indexOf(bodyId)
          if (idx !== -1) {
            this._bodiesWithListeners.splice(idx, 1)
          }
        })
      }
      if (payload.remove) {
        payload.remove.forEach(facadeId => {
          this.remove(facadeId)
        })
      }
      if (payload.add) {
        payload.add.forEach(facadeCfg => {
          this.add(facadeCfg.facadeId, facadeCfg)
        })

        // TEMP test soft body anchors. these should be a part of the generic "constraints" this engine exposes
        // if (Object.values(this._bodies.soft).length === 1 && !this._hasAnchorsTest) {
        //   const rope = Object.values(this._bodies.soft)[0]
        //   const floor = Object.values(this._bodies.rigid)[0]
        //   const block = Object.values(this._bodies.rigid)[1]
        //   var influence = 1
        //   const last = rope.get_m_nodes().size()
        //   rope.appendAnchor(0, block, true, influence)
        //   rope.appendAnchor(last - 1, floor, true, influence)
        //   this._hasAnchorsTest = true
        // }
      }
      if (payload.listenerAdd) {
        payload.listenerAdd.forEach(facadeId => {
          const bodyId = this._facadeIdsToBodyIds[facadeId]

          // TODO store collision listener params/options: `1` is a basic onCollision listener, `2` could be one with contactPoints in addition
          this._bodiesWithListeners.push(bodyId)
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

      if (this._vehicles.length > 0) {
        this.sendVehicles()
      }
      if (this._bodiesWithListeners.length > 0) {
        this.sendCollisions(deltaTimeSec) // TODO only send if we know there are collision listeners?
      }
      if (this._constraints.length > 0) {
        this.sendConstraints()
      }
      this.sendRigidBodies()
      this.sendSoftBodies()

      if (this.debugDrawer) {
        this.sendDebugInfo()
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
            this._rigidOutput = data
            break
          case MSG_TYPES.SOFT_OUTPUT:
            this._softOutput = data
            break
          case MSG_TYPES.COLLISION_OUTPUT:
            this._collisionOutput = data
            break
          case MSG_TYPES.CONSTRAINT_OUTPUT:
            this._constraintOutput = data
            break
          case MSG_TYPES.VEHICLE_OUTPUT:
            this._vehicleOutput = data
            break
          case MSG_TYPES.DEBUG_OUTPUT:
            this.debugDrawer.handleTxReturn(data)
            break
          default:
            console.error('Unrecognized transferable payload received')
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
