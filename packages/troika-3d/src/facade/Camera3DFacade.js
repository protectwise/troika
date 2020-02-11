import {
  PerspectiveCamera,
  OrthographicCamera,
  Frustum,
  Matrix4,
  Raycaster,
  Ray,
  Vector2,
  Vector3,
  Object3D,
  Quaternion
} from 'three'
import Object3DFacade from './Object3DFacade.js'

const noop = function() {}
const tempRaycaster = new Raycaster()
const tempVec2 = new Vector2()
const tempVec3 = new Vector3()
const tempMat4 = new Matrix4()
const tempQuat = new Quaternion()
const lookAtUp = new Vector3(0, 1, 0)

let _projectionMatrixVersion = 0

export function createCameraFacade(threeJsCameraClass, projectionProps, otherProps) {
  class Camera3DFacade extends Object3DFacade {
    constructor(parent) {
      const camera = new threeJsCameraClass()
      super(parent, camera)
      this.lookAt = this.up = null
      this._projectionChanged = false
      this._frustum = new Frustum()

      // Forcibly prevent updateMatrixWorld from doing anything when called; the renderer
      // likes to call this even though matrixAutoUpdate=false which can sometimes clobber
      // our optimized `updateMatrices` handling and any custom adjustments it may make.
      // TODO consider doing this at the Object3DFacade level?
      camera.updateMatrixWorld = noop
    }

    afterUpdate() {
      // Apply lookAt+up as a final transform - applied as individual quaternion
      // properties so they can selectively trigger updates, be transitioned, etc.
      if (this.lookAt) {
        tempVec3.copy(this.lookAt)
        lookAtUp.copy(this.up || Object3D.DefaultUp)
        tempMat4.lookAt(this.threeObject.position, tempVec3, lookAtUp)
        tempQuat.setFromRotationMatrix(tempMat4)
        this.quaternionX = tempQuat.x
        this.quaternionY = tempQuat.y
        this.quaternionZ = tempQuat.z
        this.quaternionW = tempQuat.w
      }
      super.afterUpdate()
    }

    updateMatrices() {
      let camObj = this.threeObject

      // Projection changes require a projection matrix rebuild - see setters below
      if (this._projectionChanged) {
        camObj.updateProjectionMatrix()
        this._projectionChanged = false
        this._projectionMatrixVersion = _projectionMatrixVersion++
      }

      // If changing the world matrix, also update its inverse
      let matrixVersionBeforeUpdate = this._worldMatrixVersion
      super.updateMatrices()
      if (matrixVersionBeforeUpdate !== this._worldMatrixVersion) {
        camObj.matrixWorldInverse.getInverse(camObj.matrixWorld)
      }
    }

    /**
     * Utility method that returns a Frustum object which is initialized to match this camera's
     * current state. This can be used for example to optimize updates to the Facade tree by
     * avoiding work for objects that fall outside the camera's view.
     *
     * You can access this by calling `this.getCameraFacade().getFrustum()` from any Object3DFacade's
     * `afterUpdate` lifecycle method or later.
     *
     * Be careful that this Frustum does not get modified after it is requested, as it is cached for
     * the lifetime of the camera's current world matrix and modifiying it would result in bad state
     * for other code requesting it within that lifetime.
     *
     * @return {Frustum}
     */
    getFrustum() {
      this.updateMatrices()
      let frustum = this._frustum
      let {_worldMatrixVersion, _projectionMatrixVersion} = this
      if (frustum._lastWorldMatrixVersion !== _worldMatrixVersion || frustum._lastProjMatrixVersion !== _projectionMatrixVersion) {
        let camObj = this.threeObject
        let matrix = new Matrix4().multiplyMatrices(camObj.projectionMatrix, camObj.matrixWorldInverse)
        frustum.setFromMatrix(matrix)
        frustum._lastWorldMatrixVersion = _worldMatrixVersion
        frustum._lastProjMatrixVersion = _projectionMatrixVersion
      }
      return frustum
    }

    /**
     * Given a set of camera projection coordinates (u,v in the range [-1, 1]), return a `Ray`
     * representing that line of sight in worldspace.
     * @param {number} u
     * @param {number} v
     * @return Ray
     */
    getRayAtProjectedCoords(u, v) {
      // By default we use the builtin Raycaster functionality, but this can be overridden
      const ray = tempRaycaster.ray = new Ray()
      tempRaycaster.setFromCamera(tempVec2.set(u, v), this.threeObject)
      return ray
    }
  }

  // Setters for properties which require a matrix update
  function defineProp(prop, affectsProjection) {
    Object.defineProperty(Camera3DFacade.prototype, prop, {
      set(val) {
        if (val !== this.threeObject[prop]) {
          this.threeObject[prop] = val
          if (affectsProjection) this._projectionChanged = true
        }
      },
      get() {
        return this.threeObject[prop]
      }
    })
  }

  projectionProps.forEach(prop => {
    defineProp(prop, true)
  })

  if (otherProps) {
    otherProps.forEach(prop => {
      defineProp(prop, false)
    })
  }

  return Camera3DFacade
}


export const PerspectiveCamera3DFacade = createCameraFacade(PerspectiveCamera, ['fov', 'aspect', 'near', 'far'], ['focus', 'filmGauge', 'filmOffset'])
export const OrthographicCamera3DFacade = createCameraFacade(OrthographicCamera, ['left', 'right', 'top', 'bottom', 'near', 'far'])
