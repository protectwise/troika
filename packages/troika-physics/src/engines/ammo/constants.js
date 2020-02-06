// More info on states https://pybullet.org/Bullet/phpBB3/viewtopic.php?t=6221
const ACTIVATION_STATES = Object.freeze({
  ACTIVE_TAG: 1,
  ISLAND_SLEEPING: 2,
  WANTS_DEACTIVATION: 3, // Don't manually set this
  DISABLE_DEACTIVATION: 4,
  DISABLE_SIMULATION: 5
})

const COLLISION_FLAGS = Object.freeze({
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
})

const MSG_TYPES = {
  RIGID_OUTPUT: 0,
  COLLISION_OUTPUT: 1,
  VEHICLE_OUTPUT: 2,
  CONSTRAINT_OUTPUT: 3,
  SOFT_OUTPUT: 4,
  DEBUG_OUTPUT: 5
}

const DEBUG_MAX_BUFFER_SIZE = 1000000 // Max buffer size for color and position arrays (3 dimensional) within the debug transferrable payload
const DEBUG_MSG = {
  NEEDS_UPDATE: 0,
  DRAW_ON_TOP: 1,
  GEOM_DRAW_RANGE_IDX_START: 2,
  GEOM_DRAW_RANGE_IDX_END: 3,
  POSITIONS_BASE: 4,
  COLORS_BASE: 5 + (DEBUG_MAX_BUFFER_SIZE * 3)
}
const DEBUG_OUTPUT_SIZE = 0 +
  1 + // Bool (1|0) needsUpdate
  1 + // Bool (1|0) DRAW_ON_TOP
  2 + // Array ([startI, endI]) geometryDrawRange
  (DEBUG_MAX_BUFFER_SIZE * 3) + // 3D positionBuffer
  (DEBUG_MAX_BUFFER_SIZE * 3) // 3D colorBuffer

const MSG_ITEM_SIZES = {
  RIGID: 14,
  // [
  //   facadeId,
  //   posX, posY, posZ,
  //   quatX, quatY, quatZ, quatW,
  //   linearVelocityX, linearVelocityY, linearVelocityZ,
  //   angularVelocityX, angularVelocityY, angularVelocityZ,
  // ]
  COLLISION: 5,
  VEHICLE: 9,
  CONSTRAINT: 6,
  SOFT: 4, // FIXME update
  DEBUG: DEBUG_OUTPUT_SIZE
}

const CONSTRAINT_TYPES = {
  POINT_TO_POINT: 0,
  HINGE: 1,
  SLIDER: 2,
  CONE_TWIST: 3,
  SIX_DOF: 4
}

export default Object.freeze({
  DEFAULT_MARGIN: 0.05,
  DEFAULT_GRAVITY: -9.8, // m/s^2
  DEFAULT_ACTIVATION_STATE: ACTIVATION_STATES.ACTIVE_TAG, // DISABLE_DEACTIVATION,
  ACTIVATION_STATES,
  COLLISION_FLAGS,
  // Map generic method names used by troika-physics to this physics engine
  METHODS_TO_AMMO: Object.freeze({
    Vector3: 'btVector3'
  }),
  MSG_HDR_SZ: 2, // Length of message header, [<message id>, <number of items in payload>, ...payload]
  MSG_TYPES,
  MSG_ITEM_SIZES,
  DEBUG_MAX_BUFFER_SIZE,
  DEBUG_MSG,
  CONSTRAINT_TYPES
})
