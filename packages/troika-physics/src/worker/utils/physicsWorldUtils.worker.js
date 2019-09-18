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
  // FIXME copy motion state? velocity is reset
  if (!body.isActive()) {
    body.activate() // If this body was sleeping, activate it
  }
}

function updateCollisionShapeMatrix (body, worldMatrixElements) {
  // console.log(`~~ update matrix`, worldMatrixElements)
  
  // const collisionShape = body.getCollisionShape()
  // if (!collisionShape || !collisionShape.setLocalScaling) {
  //   throw new Error(`Collision shape: not found or does not support the setLocalScaling method.`)
  // }

  // body
  //   .getWorldTransform()
  //   .setFromOpenGLMatrix(worldMatrixElements) //
  // singletonTransform.setIdentity() // Reset
  const newTransform = new Ammo.btTransform()
  // const motionState = body.getMotionState()
    
  // body.getMotionState().getWorldTransform(newTransform) // Copy motionState transform to shared transform object
  newTransform.setFromOpenGLMatrix(worldMatrixElements) // Update the transform
  body.getMotionState().setWorldTransform(newTransform) // Apply back to the body's motionState

  // body.setWorldTransform(new Ammo.btVector3(scaleX, scaleY, scaleZ))
  // if (!body.isActive()) {
  //   body.activate() // If this body was sleeping, activate it
  // }
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
  updateCollisionShapeMatrix,
  disableDeactivation
}
