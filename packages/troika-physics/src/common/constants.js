
const MSG_TYPES = Object.freeze({
  RIGID_OUTPUT: 0,
  SOFT_OUTPUT: 1,
  COLLISION_OUTPUT: 2,
  CONSTRAINT_OUTPUT: 3,
  VEHICLE_OUTPUT: 4,
  DEBUG_OUTPUT: 5
})

const DEBUG_MAX_BUFFER_SIZE = 1000000 // Max buffer size for color and position arrays (3 dimensional) within the debug transferrable payload
const DEBUG_MSG = Object.freeze({
  NEEDS_UPDATE: 0,
  DRAW_ON_TOP: 1,
  GEOM_DRAW_RANGE_IDX_START: 2,
  GEOM_DRAW_RANGE_IDX_END: 3,
  POSITIONS_BASE: 4,
  COLORS_BASE: 5 + (DEBUG_MAX_BUFFER_SIZE * 3)
})
const DEBUG_MSG_SIZE = 0 +
  1 + // Bool (1|0) needsUpdate
  1 + // Bool (1|0) DRAW_ON_TOP
  2 + // Array ([startI, endI]) geometryDrawRange
  (DEBUG_MAX_BUFFER_SIZE * 3) + // 3D positionBuffer
  (DEBUG_MAX_BUFFER_SIZE * 3) // 3D colorBuffer

const RIGID_MSG_SIZE = 14
// [
//   facadeId,
//   posX, posY, posZ,
//   quatX, quatY, quatZ, quatW,
//   linearVelocityX, linearVelocityY, linearVelocityZ,
//   angularVelocityX, angularVelocityY, angularVelocityZ,
// ]

const CONSTRAINT_TYPES = Object.freeze({
  POINT_TO_POINT: 0,
  HINGE: 1,
  SLIDER: 2,
  CONE_TWIST: 3,
  SIX_DOF: 4
})

const SOFT_BODY_TYPE = Object.freeze({
  TRIMESH: 3,
  CLOTH: 2,
  ROPE: 1
})

const SOFT_BODY_MSG_SIZES = Object.freeze({
  HDR: 3, // [bodyId, bodyType, updateSize (number of data points for this body), ...updateData]
  TRIMESH: 6, // [vertX, vertY, vertZ, normalX, normalY, normalZ] // NOTE will change if we update to Bullet 3 and use `m_faces`
  CLOTH: 6, // [vertX, vertY, vertZ, normalX, normalY, normalZ]
  ROPE: 3 // [vertX, vertY, vertZ]
})

const CONTACT_SIZE = 0 +
  3 + // pointA XYZ
  3 + // pointB XYZ
  3 + // pointNormalXYZ
  1 + // pointImpulse,
  1 // pointForce

const COLLISION_SIZE = 0 +
  1 + // bodyAId
  1 + // bodyBId
  1 + // num contacts
  (4 * CONTACT_SIZE) // Max 4 possible collision contacts

export default Object.freeze({
  DEFAULT_MARGIN: 0.5,
  DEFAULT_GRAVITY: -9.8, // m/s^2
  MSG_HDR_SZ: 2, // Length of message header, [<message id>, <number of items in payload>, ...payload]
  MSG_TYPES,
  RIGID_MSG_SIZE,
  DEBUG_MAX_BUFFER_SIZE,
  DEBUG_MSG,
  DEBUG_MSG_SIZE,
  CONSTRAINT_TYPES,
  SOFT_BODY_TYPE,
  SOFT_BODY_MSG_SIZES,
  CONTACT_SIZE,
  COLLISION_SIZE
})
