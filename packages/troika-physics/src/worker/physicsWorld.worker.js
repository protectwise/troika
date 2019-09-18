'use strict';

var Module = { TOTAL_MEMORY: 256 * 1024 * 1024 }

const DEFAULT_GRAVITY = -9.8
const DEFAULT_MARGIN = 0.05

// More info on states https://pybullet.org/Bullet/phpBB3/viewtopic.php?t=6221
const ACTIVATION_STATES = {
  ACTIVE_TAG: 1,
  ISLAND_SLEEPING: 2,
  WANTS_DEACTIVATION: 3, // Don't manually set this
  DISABLE_DEACTIVATION: 4,
  DISABLE_SIMULATION: 5
}

// By default, no bodies will be allowed to "sleep" in the simulation
const DEFAULT_ACTIVATION_STATE = ACTIVATION_STATES.DISABLE_DEACTIVATION

const COLLISION_FLAGS = {
  CF_STATIC_OBJECT: 1,
  CF_KINEMATIC_OBJECT: 2,
  CF_NO_CONTACT_RESPONSE: 4,
  CF_CUSTOM_MATERIAL_CALLBACK: 8,
  CF_CHARACTER_OBJECT: 16,
  CF_DISABLE_VISUALIZE_OBJECT: 32,
  CF_DISABLE_SPU_COLLISION_PROCESSING: 64,
  CF_HAS_CONTACT_STIFFNESS_DAMPING: 128,
  CF_HAS_CUSTOM_DEBUG_RENDERING_COLOR: 256,
  CF_HAS_FRICTION_ANCHOR: 512,
  CF_HAS_COLLISION_SOUND_TRIGGER: 1024
}

function createWorkerPhysicsWorld () {
  let nextFacadeId = 0 // numeric index

  // Physics variables
  const rigidBodyFacades = {}
  const bodyIdsToFacadeIds = {}
  const facadeIdsToBodyIds = {}

  const softBodies = []

  let transformAux1 = null
  let softBodyHelpers = null
  let physicsWorld = null

  function _initPhysics () {
    // Physics configuration
    const collisionConfiguration = new Ammo.btSoftBodyRigidBodyCollisionConfiguration()
    const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration)
    const broadphase = new Ammo.btDbvtBroadphase()
    const solver = new Ammo.btSequentialImpulseConstraintSolver()
    const softBodySolver = new Ammo.btDefaultSoftBodySolver()

    physicsWorld = new Ammo.btSoftRigidDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration, softBodySolver)

    physicsWorld.setGravity(new Ammo.btVector3(0, DEFAULT_GRAVITY, 0))
    physicsWorld.getWorldInfo().set_m_gravity(new Ammo.btVector3(0, DEFAULT_GRAVITY, 0))

    transformAux1 = new Ammo.btTransform()
    softBodyHelpers = new Ammo.btSoftBodyHelpers()
  }

  function recurComposeArgs (args = []) {
    const output = []

    for (let i = 0, iLen = args.length; i < iLen; i++) {
      const arg = args[i]
      if (arg['method']) {
        // arg is an Ammo constructor
        const _method = arg['method']
        const argArgs = recurComposeArgs(arg['args'] || [])
        if (!Ammo.hasOwnProperty(_method)) {
          throw new Error(`Ammo missing specified constructor: ${_method}`)
        }
        output.push(
          new Ammo[_method](...argArgs)
        )
      } else {
        output.push(arg) // Simple args just get passed along
      }
    }

    return output
  }

  let _cachedSphere
  let _cachedBox

  function createPhysicsShape (shapeConfig) {
    const { shape, ctrArgs = [], shapeActions = [] } = shapeConfig
    const composedArgs = recurComposeArgs(ctrArgs)
    let ammoShape

    // NOTE re: caching/sharing https://pybullet.org/Bullet/BulletFull/classbtRigidBody.html
    // > It is recommended for performance and memory use to share btCollisionShape objects whenever possible.
    // NOTE: shape localScaling gets applied to all shapes when sharing objects.

    switch (shape) {
      case 'sphere': {
        // ammoShape = _cachedSphere || (_cachedSphere = new Ammo.btSphereShape(...composedArgs))
        ammoShape = new Ammo.btSphereShape(...composedArgs)
        break
      }
      case 'box': {
        // ammoShape = _cachedBox || (_cachedBox = new Ammo.btBoxShape(...composedArgs))
        ammoShape = new Ammo.btBoxShape(...composedArgs)
        break
      }
      default:
        throw new Error(`Unsupported shape specified: ${shape}`)
    }

    /** 
     * http://www.cs.kent.edu/~ruttan/GameEngines/lectures/Bullet_User_Manual
     * Collision Margin
Bullet uses a small collision margin for collision shapes, to improve performance and reliability of the
collision detection. It is best not to modify the default collision margin, and if you do use a positive
value: zero margin might introduce problems. By default this collision margin is set to 0.04, which is 4
centimeter if your units are in meters (recommended).
    */
    // ammoShape.setMargin(DEFAULT_MARGIN) // TODO allow config adjustments

    for (let aI = 0; aI < shapeActions.length; aI++) {
      const { method, args = [] } = shapeActions[aI]
      const composedActionArgs = recurComposeArgs(args)
      ammoShape[method](...composedActionArgs)
    }

    return ammoShape
  }

  // https://pybullet.org/Bullet/BulletFull/classbtRigidBody.html
  function addRigidBody (facadeId, rigidBodyConfig) {
    const {
      shapeConfig,
      physicsConfig,
      initialPos,
      initialQuat
    } = rigidBodyConfig
    const {
      mass,
      friction,
      restitution,
      isRigidBody = true,
      isDisabled,
      isKinematic = false
    } = physicsConfig
    // console.log(`~~ physicsWorld:addRigidBody`, facadeId, rigidBodyConfig)
    if (isKinematic && mass > 0) {
      console.warn(`Kinematic bodies must have a mass of zero. Mass provided: ${mass}`)
    }

    const physicsShape = createPhysicsShape(shapeConfig)

    var transform = new Ammo.btTransform()
    transform.setIdentity()
    transform.setOrigin(new Ammo.btVector3(initialPos.x, initialPos.y, initialPos.z))
    transform.setRotation(new Ammo.btQuaternion(initialQuat.x, initialQuat.y, initialQuat.z, initialQuat.w))


    var motionState = new Ammo.btDefaultMotionState(transform)

    var localInertia = new Ammo.btVector3(0, 0, 0)
    physicsShape.calculateLocalInertia(mass, localInertia)
    var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, physicsShape, localInertia)
    var body = new Ammo.btRigidBody(rbInfo)

    if (isKinematic) {
      console.log(`~~ Adding kinematic rigidBody`, physicsConfig)
      body.setCollisionFlags(COLLISION_FLAGS.CF_KINEMATIC_OBJECT)
      utils.disableDeactivation(body)
    }

    if (mass > 0) {
      // Disable deactivation // TODO evaluate if we need this. Expose `initialActivationState` with default
      // utils.disableDeactivation(body)
      // const initialActivationState = isDisabled
      //   ? ACTIVATION_STATES.DISABLE_SIMULATION
      //   : DEFAULT_ACTIVATION_STATE

      // body.setActivationState(initialActivationState)
    }
    
    if (friction) {
      body.setFriction(friction)
    }
    if (restitution) {
      body.setRestitution(restitution)
    }

    // Set indexes/keys
    const bodyId = nextFacadeId++
    body.setUserIndex(bodyId)

    // body.setUserPointer({facadeId})
    bodyIdsToFacadeIds[bodyId] = facadeId
    facadeIdsToBodyIds[facadeId] = bodyId

    rigidBodyFacades[facadeId] = body

    physicsWorld.addRigidBody(body)
  }

  // function _rescaleCollisionShape (body, scaleArgs) {
  //   const [scaleX, scaleY, scaleZ] = scaleArgs
  //   const collisionShape = body.getCollisionShape()
  //   if (!collisionShape || !collisionShape.setLocalScaling) {
  //     throw new Error(`Collision shape: not found or does not support the setLocalScaling method.`)
  //   }
  //   const shapeName = collisionShape.getName()
  //   console.log(`~~ shapename`, shapeName)

  //   collisionShape.setLocalScaling(new Ammo.btVector3(scaleX, scaleY, scaleZ))
  // }

  function removeRigidBody (facadeId) {
    const body = rigidBodyFacades[facadeId]
    // console.log(`~~ physicsWorld:removeRigidBody`, facadeId)
    physicsWorld.removeRigidBody(body)

    const bodyId = facadeIdsToBodyIds[facadeId]
    delete bodyIdsToFacadeIds[bodyId]
    delete rigidBodyFacades[facadeId]
    delete facadeIdsToBodyIds[facadeId]
  }

  function setBodyActivationState (facadeId, isPaused) {
    // console.log(`~~ setting activation states`,facadeId, isPaused )
    const soft = true // If true, will still passively collide with other bodies
    const body = rigidBodyFacades[facadeId]
    const deactivatedState = soft ? ACTIVATION_STATES.ISLAND_SLEEPING : ACTIVATION_STATES.DISABLE_SIMULATION
    // Remove body
    // physicsWorld.removeRigidBody(body)

    // Update activationState
    const newActivationState = isPaused
      ? deactivatedState
      : DEFAULT_ACTIVATION_STATE
    body.forceActivationState(newActivationState)

    // Re-add to physicsWorld
    // physicsWorld.addRigidBody(body)

    // rigidBodyFacades[facadeId] = body // Update reference?
  }

  // function positionUpdateRequest (facadeId, propName, value) {
  //   const body = rigidBodyFacades[facadeId]
  //   console.log(`~~ worker positionUpdateRequest`)

  // }

  function updatePhysicsShape (facadeId, shapeMethodConfig) {
    const body = rigidBodyFacades[facadeId]
    if (!body) {
      console.warn(`~~ updatePhysicsShape: body not found`, facadeId, rigidBodyFacades)

      return
    }
    const collisionShape = body.getCollisionShape()

    // console.log(`~~ updating physics shape`, facadeId, shapeMethodConfig)

    const { method, args } = shapeMethodConfig
    const composedArgs = recurComposeArgs(args || [])
    collisionShape[method](...composedArgs)

    // body.setCollisionShape(collisionShape)

    // if (method === 'setLocalScaling') {
    //   physicsWorld.updateSingleAABB(body)
    // }
  }

  function batchedBodyUpdates (updateSet) {
    for (const facadeId in updateSet) {
      const facadeUpdates = updateSet[facadeId]
      const body = rigidBodyFacades[facadeId]
      if (!body) {
        console.warn(`~~ batchedBodyUpdates: body not found:`, facadeId, rigidBodyFacades)
        return
      }
      for (const updateType in facadeUpdates) {
        const updateArgs = facadeUpdates[updateType]
        // console.log(`~~ worker batchedBodyUpdates`, facadeId, updateType, updateArgs)

        switch (updateType) {
          case 'rescale':
            utils.rescaleCollisionShape(body, updateArgs)
            break
          case 'worldMatrixChange':
            utils.updateCollisionShapeMatrix(body, updateArgs)
            break
          default:
            console.warn(`~~ Unsupported batchBodyUpdate updateType`, updateType)
            break
        }
      }
    }
    // console.log(`~~ worker rescaleshape`, facadeId, scaleProp, scaleValue)
  }

  function getCollisions (deltaTimeSec) {
    const output = []
    let collisionArr
    let contactsArr
    // https://pybullet.org/Bullet/phpBB3/viewtopic.php?f=9&t=1691&start=0
    const numManifolds = physicsWorld.getDispatcher().getNumManifolds()
    for (let i = 0; i < numManifolds; i++) {
      const contactManifold = physicsWorld.getDispatcher().getManifoldByIndexInternal(i)
      const bodyA = contactManifold.getBody0() // btCollisionObject
      const bodyB = contactManifold.getBody1() // btCollisionObject

      // TODO only output for events involving a body that has
      // a onCollision event handler
      // collisionArr = [] 
      // FIXME use preallocated arrays or transferrables
      collisionArr = [
        bodyIdsToFacadeIds[bodyA.getUserIndex()], // bodyA facadeId
        bodyIdsToFacadeIds[bodyB.getUserIndex()] // bodyB facadeId
        // [] contactPoints
      ]

      // TODO if Facade's registered for collision _contact points_, compute them below
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

  // TODO cache transferable Array and re-use when size is not changing (no new shapes added/removed)
  // TODO use flattened Float32Array
  const transferableOutput = null

  function updatePhysicsWorld (deltaTimeSec) {
    physicsWorld.stepSimulation(deltaTimeSec, 10)

    // console.log(`~~ worker updatePhysics`, deltaTimeSec)
    
    
    const rigidBodyOutput = [] // new Float32Array()
    let facadeOutput

    // Update rigid bodies
    for (const facadeId in rigidBodyFacades) {
      if (rigidBodyFacades.hasOwnProperty(facadeId)) {
        const physicsBody = rigidBodyFacades[facadeId]

        // Only update motionState for active (activationState) bodies
        if (physicsBody.isActive()) {
          const motionState = physicsBody.getMotionState()

          if (motionState) {
            facadeOutput = new Array(8)
            facadeOutput[0] = facadeId
            motionState.getWorldTransform(transformAux1)
            var pos = transformAux1.getOrigin()
            facadeOutput[1] = pos.x()
            facadeOutput[2] = pos.y()
            facadeOutput[3] = pos.z()
            var quat = transformAux1.getRotation()
            facadeOutput[4] = quat.x()
            facadeOutput[5] = quat.y()
            facadeOutput[6] = quat.z()
            facadeOutput[7] = quat.w()

            rigidBodyOutput.push(facadeOutput)
          }
        }
      }
    }

    // Update soft volumes
    // for ( var i = 0, il = softBodies.length; i < il; i ++ ) {
    //   var volume = softBodies[ i ];
    //   var geometry = volume.geometry;
    //   var softBody = volume.userData.physicsBody;
    //   var volumePositions = geometry.attributes.position.array;
    //   var volumeNormals = geometry.attributes.normal.array;
    //   var association = geometry.ammoIndexAssociation;
    //   var numVerts = association.length;
    //   var nodes = softBody.get_m_nodes();
    //   for ( var j = 0; j < numVerts; j ++ ) {
    //     var node = nodes.at( j );
    //     var nodePos = node.get_m_x();
    //     var x = nodePos.x();
    //     var y = nodePos.y();
    //     var z = nodePos.z();
    //     var nodeNormal = node.get_m_n();
    //     var nx = nodeNormal.x();
    //     var ny = nodeNormal.y();
    //     var nz = nodeNormal.z();
    //     var assocVertex = association[ j ];
    //     for ( var k = 0, kl = assocVertex.length; k < kl; k ++ ) {
    //       var indexVertex = assocVertex[ k ];
    //       volumePositions[ indexVertex ] = x;
    //       volumeNormals[ indexVertex ] = nx;
    //       indexVertex ++;
    //       volumePositions[ indexVertex ] = y;
    //       volumeNormals[ indexVertex ] = ny;
    //       indexVertex ++;
    //       volumePositions[ indexVertex ] = z;
    //       volumeNormals[ indexVertex ] = nz;
    //     }
    //   }
    //   geometry.attributes.position.needsUpdate = true;
    //   geometry.attributes.normal.needsUpdate = true;
    // }

    // Get collision pairs
    const collisionsOutput = getCollisions(deltaTimeSec)

    // if (rigidBodyOutput.length > 0) {
    postMessage({
      type: 'physicsWorldUpdated',
      rigidBodies: rigidBodyOutput,
      collisions: collisionsOutput
    })
    // }
  }

  // Init
  _initPhysics()

  return {
    updatePhysicsWorld,
    addRigidBody,
    removeRigidBody,
    setBodyActivationState,
    updatePhysicsShape,
    batchedBodyUpdates
    // positionUpdateRequest
  }
}

// Ammo().then(function(Ammo) {
//   postMessage({log: `~~ LOADED AMMO WASM`, ammot: typeof Ammo})

//   // var NUM = 0, NUMRANGE = [];

//   // Bullet-interfacing code

//   // var collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
//   // var dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
//   // var overlappingPairCache = new Ammo.btDbvtBroadphase();
//   // var solver = new Ammo.btSequentialImpulseConstraintSolver();
//   // var dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
//   // dynamicsWorld.setGravity(new Ammo.btVector3(0, -10, 0));

//   // var groundShape = new Ammo.btBoxShape(new Ammo.btVector3(50, 50, 50));

//   // var bodies = [];

//   // var groundTransform = new Ammo.btTransform();
//   // groundTransform.setIdentity();
//   // groundTransform.setOrigin(new Ammo.btVector3(0, -56, 0));

//   // (function() {
//   //   var mass = 0;
//   //   var localInertia = new Ammo.btVector3(0, 0, 0);
//   //   var myMotionState = new Ammo.btDefaultMotionState(groundTransform);
//   //   var rbInfo = new Ammo.btRigidBodyConstructionInfo(0, myMotionState, groundShape, localInertia);
//   //   var body = new Ammo.btRigidBody(rbInfo);

//   //   dynamicsWorld.addRigidBody(body);
//   //   bodies.push(body);
//   // })();

//   // var boxShape = new Ammo.btBoxShape(new Ammo.btVector3(1, 1, 1));

//   // function resetPositions() {
//   //   var side = Math.ceil(Math.pow(NUM, 1/3));
//   //   var i = 1;
//   //   for (var x = 0; x < side; x++) {
//   //     for (var y = 0; y < side; y++) {
//   //       for (var z = 0; z < side; z++) {
//   //         if (i == bodies.length) break;
//   //         var body = bodies[i++];
//   //         var origin = body.getWorldTransform().getOrigin();
//   //         origin.setX((x - side/2)*(2.2 + Math.random()));
//   //         origin.setY(y * (3 + Math.random()));
//   //         origin.setZ((z - side/2)*(2.2 + Math.random()) - side - 3);
//   //         body.activate();
//   //         var rotation = body.getWorldTransform().getRotation();
//   //         rotation.setX(1);
//   //         rotation.setY(0);
//   //         rotation.setZ(0);
//   //         rotation.setW(1);
//   //       }
//   //     }
//   //   }
//   // }

//   // function startUp() {
//   //   NUMRANGE.forEach(function(i) {
//   //     var startTransform = new Ammo.btTransform();
//   //     startTransform.setIdentity();
//   //     var mass = 1;
//   //     var localInertia = new Ammo.btVector3(0, 0, 0);
//   //     boxShape.calculateLocalInertia(mass, localInertia);

//   //     var myMotionState = new Ammo.btDefaultMotionState(startTransform);
//   //     var rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, myMotionState, boxShape, localInertia);
//   //     var body = new Ammo.btRigidBody(rbInfo);

//   //     dynamicsWorld.addRigidBody(body);
//   //     bodies.push(body);
//   //   });

//   //   resetPositions();
//   // }

//   // var transform = new Ammo.btTransform(); // taking this out of readBulletObject reduces the leaking

//   // function readBulletObject(i, object) {
//   //   var body = bodies[i];
//   //   body.getMotionState().getWorldTransform(transform);
//   //   var origin = transform.getOrigin();
//   //   object[0] = origin.x();
//   //   object[1] = origin.y();
//   //   object[2] = origin.z();
//   //   var rotation = transform.getRotation();
//   //   object[3] = rotation.x();
//   //   object[4] = rotation.y();
//   //   object[5] = rotation.z();
//   //   object[6] = rotation.w();
//   // }

//   // var nextTimeToRestart = 0;
//   // function timeToRestart() { // restart if at least one is inactive - the scene is starting to get boring
//   //   if (nextTimeToRestart) {
//   //     if (Date.now() >= nextTimeToRestart) {
//   //       nextTimeToRestart = 0;
//   //       return true;
//   //     }
//   //     return false;
//   //   }
//   //   for (var i = 1; i <= NUM; i++) {
//   //     var body = bodies[i];
//   //     if (!body.isActive()) {
//   //       nextTimeToRestart = Date.now() + 1000; // add another second after first is inactive
//   //       break;
//   //     }
//   //   }
//   //   return false;
//   // }

//   // var meanDt = 0, meanDt2 = 0, frame = 1;

//   // function simulate(dt) {
//   //   dt = dt || 1;

//   //   dynamicsWorld.stepSimulation(dt, 2);

//   //   var alpha;
//   //   if (meanDt > 0) {
//   //     alpha = Math.min(0.1, dt/1000);
//   //   } else {
//   //     alpha = 0.1; // first run
//   //   }
//   //   meanDt = alpha*dt + (1-alpha)*meanDt;

//   //   var alpha2 = 1/frame++;
//   //   meanDt2 = alpha2*dt + (1-alpha2)*meanDt2;

//   //   var data = { objects: [], currFPS: Math.round(1000/meanDt), allFPS: Math.round(1000/meanDt2) };

//   //   // Read bullet data into JS objects
//   //   for (var i = 0; i < NUM; i++) {
//   //     var object = [];
//   //     readBulletObject(i+1, object);
//   //     data.objects[i] = object;
//   //   }

//   //   postMessage(data);

//   //   if (timeToRestart()) resetPositions();
//   // }

//   // var interval = null;

// //   onmessage = function(event) {
// //     postMessage(`~~ worker.wasm.js:onMessage echo`)

// //     // NUM = event.data;
// //     // NUMRANGE.length = 0;
// //     // while (NUMRANGE.length < NUM) NUMRANGE.push(NUMRANGE.length+1);

// //     // frame = 1;
// //     // meanDt = meanDt2 = 0;

// //     // startUp();

// //     // var last = Date.now();
// //     // function mainLoop() {
// //     //   var now = Date.now();
// //     //   simulate(now - last);
// //     //   last = now;
// //     // }

// //     // if (interval) clearInterval(interval);
// //     // interval = setInterval(mainLoop, 1000/60);
// //   }

// });

let methods = {
  init
}

function init (urlOrigin) {
  importScripts(`engines/ammojs/loadAmmo.js`)

  Ammo().then(function (Ammo) {
    // console.log(`~~ worker loaded Ammo lib`)
    self.Ammo = Ammo // Expose to global scope

    importScripts(`utils/physicsWorldUtils.worker.js`) // Load after Ammo is initialized

    const workerPhysicsWorldMethods = createWorkerPhysicsWorld()

    methods = {
      init,
      ...workerPhysicsWorldMethods
    }

    postMessage({ type: 'ready' })
  })
}

self.onmessage = function (message) {
  const msgData = message.data
  const {
    method,
    args = []
  } = msgData

  if (method && methods[method]) {
    methods[method](...args)
  } else {
    console.log('Unknown method message passed', msgData)
  }
}
