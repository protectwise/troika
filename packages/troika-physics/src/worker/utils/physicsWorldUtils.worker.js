"use strict";

let singletonTransform = new Ammo.btTransform()
singletonTransform.setIdentity() // Reset

function rescaleCollisionShape (body, scaleArgs) {
  const [scaleX, scaleY, scaleZ] = scaleArgs
  const collisionShape = body.getCollisionShape()
  if (!collisionShape || !collisionShape.setLocalScaling) {
    throw new Error(`Collision shape: not found or does not support the setLocalScaling method.`)
  }
  collisionShape.setLocalScaling(new Ammo.btVector3(scaleX, scaleY, scaleZ))
  
  // FIXME copy motion state? seems to lose motion when rescaling an object that is moving

  if (!body.isActive()) {
    body.activate() // If this body was sleeping, activate it
  }
}

function updateBodyMatrix (body, worldMatrixElements) {  
  // Update the transform
  // singletonTransform.setIdentity() // TODO need to reset this?
  singletonTransform.setFromOpenGLMatrix(worldMatrixElements) 
  
  // Apply transform to the body's motionState so Bullet keeps track of its velocity etc.
  body.getMotionState().setWorldTransform(singletonTransform) // Apply back to the body's motionState
}

function disableDeactivation (body, force = false) {
  const targetActivationState =  ACTIVATION_STATES.DISABLE_DEACTIVATION

  if (force) {
    body.forceActivationState(targetActivationState)
  }
  else {
    body.setActivationState(targetActivationState)
  }
}

// "export" utils to global scope
self.utils = {
  rescaleCollisionShape,
  updateBodyMatrix,
  disableDeactivation
}
