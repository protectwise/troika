/* eslint-env worker */
'use strict'

class PhysicsEngineBase {
  constructor () {
    this._nextBodyId = 0 // numeric index ID
    this._rigidBodies = {}
    this._softBodies = {}
    this._bodyIdsToFacadeIds = {}
    this._facadeIdsToBodyIds = {}
    this._facadeIdsToPhysicsConfigs = Object.create(null)
  }

  /**
   * Update the Physics World simulation using the passed deltaTime (seconds).
   *
   * @param {float} deltaTimeSec
   * @memberof PhysicsEngineBase
   * @abstract
   */
  updatePhysicsWorld (deltaTimeSec) {}

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

  /**
   * Add a body to the Physics World
   * @memberof PhysicsEngineBase
   */
  add (facadeId, bodyConfig) {
    this._facadeIdsToPhysicsConfigs[facadeId] = bodyConfig.physicsConfig
  }

  /**
   * remove a body from the Physics World
   * @memberof PhysicsEngineBase
   */
  remove (facadeId) {
    const bodyId = this._facadeIdsToBodyIds[facadeId]
    delete this._bodyIdsToFacadeIds[bodyId]
    delete this._facadeIdsToBodyIds[facadeId]
    delete this._facadeIdsToPhysicsConfigs[facadeId]
    delete this._softBodies[facadeId]
    delete this._rigidBodies[facadeId]
  }

  /**
   * Enable/disable a physics body within the Physics World
   * @memberof PhysicsEngineBase
   * @abstract
   */
  setActivationState () {}

  /**
   * Update the collision shape of a body already present in the Physics World
   * @memberof PhysicsEngineBase
   * @abstract
   */
  // updatePhysicsShape () {}

  /**
   * Handle a batched set of updates to bodies within the Physics World
   * @memberof PhysicsEngineBase
   * @abstract
   */
  batchedUpdate () {}
}

self.PhysicsEngineBase = PhysicsEngineBase
