import {PerspectiveCamera, OrthographicCamera, Frustum, Matrix4} from 'three'
import Object3DFacade from './Object3D'


export function createCameraFacade(threeJsCameraClass, projectionProps, otherProps) {
  class Camera3DFacade extends Object3DFacade {
    constructor(parent) {
      super(parent, new threeJsCameraClass())
      this._projectionChanged = false
      this._frustum = new Frustum()
    }

    afterUpdate() {
      // Projection changes require a projection matrix rebuild - see setters below
      if (this._projectionChanged) {
        this.threeObject.updateProjectionMatrix()
        this._projectionChanged = false
      }
      super.afterUpdate()
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
      if (frustum._lastCamMatrixVersion !== this._worldMatrixVersion) {
        let camObj = this.threeObject
        let matrix = new Matrix4().multiplyMatrices(camObj.projectionMatrix, camObj.matrixWorldInverse)
        frustum.setFromMatrix(matrix)
        frustum._lastCamMatrixVersion = this._worldMatrixVersion
      }
      return frustum
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
