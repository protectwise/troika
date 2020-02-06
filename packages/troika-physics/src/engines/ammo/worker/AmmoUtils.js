/* eslint-env worker */
/* eslint-disable new-cap */

export default function getAmmoUtils (Ammo, CONSTANTS) {
  const _sharedTransform = new Ammo.btTransform()
  const _sharedVec3A = new Ammo.btVector3()
  const _zeroedVec3 = new Ammo.btVector3(0, 0, 0)

  return class AmmoUtils {
    recurComposeArgs (args = []) {
      const output = []

      for (let i = 0, iLen = args.length; i < iLen; i++) {
        const arg = args[i]
        let _method = arg.method
        if (_method) {
          // arg is an Ammo constructor
          _method = CONSTANTS.METHODS_TO_AMMO[_method] || _method
          const argArgs = this.recurComposeArgs(arg.args || [])
          if (!Object.prototype.hasOwnProperty.call(Ammo, _method)) {
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

    /**
     * Set LocalScaling of a CollisionShape
     *
     * @param {CollisionObject} body
     * @param {array} scaleArgs [x,y,z]
     */
    rescaleCollisionShape (body, scaleArgs) {
      const [scaleX, scaleY, scaleZ] = scaleArgs
      const collisionShape = body.getCollisionShape()
      if (!collisionShape || !collisionShape.setLocalScaling) {
        throw new Error('Collision shape: not found or does not support the setLocalScaling method.')
      }
      _sharedVec3A.setValue(scaleX, scaleY, scaleZ)
      collisionShape.setLocalScaling(_sharedVec3A)
      if (!body.isActive()) {
        body.activate() // If this body was sleeping, activate it
      }
    }

    /**
     * Set the World Transformation Matrix for a RigidBody
     *
     * @param {RigidBody} body
     * @param {Matrix4} worldMatrixElements
     */
    updateRigidBodyMatrix (body, worldMatrixElements) {
      // Update the transform
      // _sharedTransform.setIdentity() // TODO need to reset this?
      _sharedTransform.setFromOpenGLMatrix(worldMatrixElements)

      // Apply transform to the body's motionState so Bullet keeps track of its velocity etc.
      body.getMotionState().setWorldTransform(_sharedTransform) // Apply back to the body's motionState
    }

    /**
     * Disable deactivation of a CollisionObject. Deactivation (or "sleeping") is a state that the
     * DynamicsWorld can set on bodies that have not had linear/angular changes much (i.e. objects that have "settled")
     *
     * @param {CollisionObject} body
     * @param {boolean} [force=false]
     */
    disableDeactivation (body, force = false) {
      const targetActivationState = CONSTANTS.ACTIVATION_STATES.DISABLE_DEACTIVATION

      if (force) {
        body.forceActivationState(targetActivationState)
      } else {
        body.setActivationState(targetActivationState)
      }
    }

    /**
     * Set the mass of a Collision Object (Rigid or Soft)
     *
     * @param {CollisionObject} body
     * @param {int} newMass
     * @param {boolean} isSoftBody
     * @param {btVector3} [rigidBodyInertia]
     */
    setMass (body, newMass, isSoftBody) {
      if (isSoftBody) {
        body.setTotalMass(newMass, false)
      } else {
        // const inertia = new Ammo.btVector3() 
        _sharedVec3A.setValue(0, 0, 0) // Inertia will be calculated "into" this Vec3
        body.getCollisionShape().calculateLocalInertia(newMass, _sharedVec3A)
        body.setMassProps(newMass, _sharedVec3A)
        body.updateInertiaTensor() // Inertia Tensor must be updated when mass or localScaling is changed https://pybullet.org/Bullet/phpBB3/viewtopic.php?t=2925
      }
    }

    /**
     * Clear dynamic values of a body, preparing it to be set as STATIC or KINEMATIC
     *
     * @param {CollisionObject} body
     * @param {boolean} isSoftBody
     */
    clearDynamics (body, isSoftBody) {
      this.setMass(body, 0, isSoftBody, _zeroedVec3)

      if (isSoftBody) {
        // FIXME test soft static bodies, what else needs to be zeroed here? Vertex velocities?
        console.warn('Experimental feature: Handle static soft bodies')
        body.setVelocity(_zeroedVec3)
      } else {
        // https://pybullet.org/Bullet/phpBB3/viewtopic.php?t=7772
        body.setLinearVelocity(_zeroedVec3)
        body.setAngularVelocity(_zeroedVec3)
        body.updateInertiaTensor()
      }
    }

    /**
     * Set a body to KINEMATIC
     *
     * @param {CollisionObject} body
     * @param {boolean} isKinematic
     * @param {boolean} isSoftBody
     */
    setKinematic (body, isKinematic, isSoftBody) {
      if (isKinematic) {
        body.setCollisionFlags(CONSTANTS.COLLISION_FLAGS.CF_KINEMATIC_OBJECT)
        this.disableDeactivation(body)
        this.clearDynamics(body, isSoftBody)
      } else {
        body.setCollisionFlags(0) // Clear?
        body.setActivationState(CONSTANTS.DEFAULT_ACTIVATION_STATE)
      }
    }

    /**
     * Set a body to STATIC
     *
     * @param {CollisionObject} body
     * @param {boolean} isStatic
     * @param {boolean} isSoftBody
     */
    setStatic (body, isStatic, isSoftBody) {
      if (isStatic) {
        body.setCollisionFlags(CONSTANTS.COLLISION_FLAGS.CF_STATIC_OBJECT)
        this.disableDeactivation(body)
        this.clearDynamics(body, isSoftBody)
      } else {
        body.setCollisionFlags(0) // Clear?
        body.setActivationState(CONSTANTS.DEFAULT_ACTIVATION_STATE)
      }
    }

    /**
     * Handle changes to basic Physics properties
     *
     * @param {btCollisionObject(SoftBody|RigidBody)} body
     * @param {object} newCfg
     * @param {object} prevCfg
     */
    updatePhysicsConfig (body, newCfg, prevCfg) {
      const {
        isSoftBody,
        isKinematic,
        isStatic,
        mass,
        friction,
        rollingFriction,
        spinningFriction,
        restitution,
        linearDamping, // Rigid Body only
        angularDamping, // Rigid Body only
        pressure // Soft Body only
      } = newCfg
      // const bodyTypeChanged = newCfg.isSoftBody !== prevCfg.isSoftBody // TODO should we support this? requires removal of olf collisionObject and creation of a new one

      if (isKinematic !== prevCfg.isKinematic) {
        this.setKinematic(body, isKinematic, isSoftBody)
      }
      if (isStatic !== prevCfg.isStatic) {
        this.setStatic(body, isStatic, isSoftBody)
      }
      // Simple setters for all CollisionObject bodies
      if (friction !== prevCfg.friction) {
        body.setFriction(friction)
      }
      if (rollingFriction !== prevCfg.rollingFriction) {
        body.setRollingFriction(rollingFriction)
      }
      if (spinningFriction !== prevCfg.spinningFriction) {
        body.setSpinningFriction(spinningFriction)
      }
      if (restitution !== prevCfg.restitution) {
        body.setRestitution(restitution)
      }

      if (mass !== prevCfg.mass) {
        this.setMass(body, mass, isSoftBody)
      }

      // Soft/Rigid body specific setters
      if (isSoftBody) {
        if (pressure !== prevCfg.pressure) {
          const softBodyConfig = body.get_m_cfg()
          softBodyConfig.set_kPR(pressure)
        }
      } else {
        if (linearDamping !== prevCfg.linearDamping || angularDamping !== prevCfg.angularDamping) {
          body.setDamping(linearDamping, angularDamping)
        }
      }
    }
  }
}
