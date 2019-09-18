import { Facade, utils } from 'troika-core'
import { inferPhysicsShape } from '../utils/inferPhysicsShape'

const { assign, createClassExtender } = utils

/**
 * Extends a given Facade class to become a `PhysicsObjectFacade`, allowing it to
 * have its position and rotation controlled by a `PhysicsManager`.
 *
 * Documentation of Ammo.js (ported from Bullet) Physics Implementation https://pybullet.org/Bullet/BulletFull/annotated.html
 *
 * Physical property configuration

 * physics: {
 *   isDisabled: boolean // When toggled, will delete/add the shape from the Physics World,
 *   isPaused: boolean // When toggled, will change the activation state of the shape, potentially allowing it to passively receive collisions from other shapes
 *   isKinematic: boolean // Kinematic bodies _must_ have a mass of zero. They will interact with dynamic objects in the physicsWorld, but have their position/orientation controlled by the facade parent.
 *
 *   mass: number // kilograms
 *
 *   friction: float (0-1) default=0.5
 *   rollingFriction: float(0-1) default=0
 *   spinningFriction: float(0-1) default=0
 *
 *   restitution: float (0-1) default=0  "bounciness" of an object
 *
 *   linearDamping: float(0-1) default=0 // Additional "drag" friction applied to linear (translation) motion. Applied even when bodies are not colliding.
 *   angularDamping: float(0-1) default=0 // Additional "drag" friction applied to angular (rotation) motion. Applied even when bodies are not colliding.
 * }
 *
 * @param {class} BaseFacadeClass
 * @return {PhysicsObjectFacade} a new class that extends the BaseFacadeClass
 */
export const extendAsPhysical = createClassExtender('physical', BaseFacadeClass => {
  class PhysicsObjectFacade extends BaseFacadeClass {
    constructor (parent, threeObject) {
      console.log(`~~ ctr obj`, threeObject)
      
      super(parent, threeObject)

      this.$isControlledByDynamicsWorld = false

      this._prevScaleX = this.scaleX
      this._prevScaleY = this.scaleY
      this._prevScaleZ = this.scaleZ

      if (!this._physicsShapeCfg) {
        this._physicsShapeCfg = inferPhysicsShape(this)
      }

      this.notifyWorld('physicsObjectAdded')
    }

    set physics (descriptor) {
      if (this.physics$descriptor === descriptor) return
      const prevDescriptor = this.physics$descriptor || descriptor // (this.physics$descriptor = descriptor)
      this.physics$descriptor = descriptor

      // console.log(`~~ PHYSICS CHANGED`, descriptor)
      // let hasChanged = false

      if (descriptor) {
        if (Object.prototype.hasOwnProperty.call(descriptor, 'isDisabled')) {
          // If disabled state has changed,
          if (descriptor.isDisabled !== prevDescriptor.isDisabled) {
            this.notifyWorld('physicsObjectDisabledChange', descriptor.isDisabled)
          }
        }
        if (Object.prototype.hasOwnProperty.call(descriptor, 'isPaused')) {
          if (descriptor.isPaused !== prevDescriptor.isPaused) {
            this.notifyWorld('physicsObjectPausedChange', descriptor.isPaused)
          }
        }
      }

      // if (hasChanged) {
      //   // Physics config has changed
      //   console.log(`~~ TODO handle physics config changed`)
      // }
    }

    get physics () {
      return this.physics$descriptor
    }

    afterUpdate () {
      const _prevWorldMatrixVersion = this._worldMatrixVersion

      super.afterUpdate()
  
      if (this._worldMatrixVersion !== _prevWorldMatrixVersion) {
        const scaleChanged = this._prevScaleX !== this.scaleX || this._prevScaleY !== this.scaleY || this._prevScaleZ !== this.scaleZ
        // Dynamic objects (controlled by the dynamicsWorld) need to receive troika-managed scale changes
        if (this.$isControlledByDynamicsWorld && scaleChanged) {
          // https://pybullet.org/Bullet/BulletFull/classbtCollisionShape.html
          // NOTE: btSphereShape does NOT support non-uniform scaling (scaleX/Y/Z must be identical)
          this.notifyWorld('physicsObjectScaleChange', [this.scaleX, this.scaleY, this.scaleZ])
          this._prevScaleX = this.scaleX
          this._prevScaleY = this.scaleY
          this._prevScaleZ = this.scaleZ
        }
        // Kinematic or Static objects that exist in the dynamicsWorld (OR dynamic objects that have yet to be registered within the dynamicsWorld)
        // but are not controlled/influenced by it (they _do_ influence dynamic objects)
        // need their full position/orientation/scale matrix updated
        if (!this.$isControlledByDynamicsWorld) {
          this.notifyWorld('physicsObjectMatrixChange', this.threeObject.matrixWorld.elements)
        }
      }
    }

    destructor () {
      this.notifyWorld('physicsObjectRemoved')
      super.destructor()
    }
  }

  // Ignore any parent-set position/orientation props when
  // facade is under control of the Physics/Dynamics world
  ;[
    'x', 'y', 'z',
    'quaternionX', 'quaternionY', 'quaternionZ', 'quaternionW',
    'rotateX', 'rotateY', 'rotateZ' /* 'rotateOrder */
  ].forEach(function (controlledProp) {
    Object.defineProperty(PhysicsObjectFacade.prototype, controlledProp, {
      get: function () {
        return Reflect.get(BaseFacadeClass.prototype, controlledProp, this)
      },
      set: function (value) {
        if (this.$isControlledByDynamicsWorld) return // dynamicsWorld is driving this property, user/troika-set updates are ignored
        Reflect.set(BaseFacadeClass.prototype, controlledProp, value, this)
      }
    })
  })

  Facade.defineEventProperty(PhysicsObjectFacade, 'onCollision', 'collision')

  return PhysicsObjectFacade
})
