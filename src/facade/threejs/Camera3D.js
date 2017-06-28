import {PerspectiveCamera, OrthographicCamera} from 'three'
import Object3DFacade from './Object3D'


export function createCameraFacade(threeJsCameraClass, projectionProps, otherProps) {
  class Camera3DFacade extends Object3DFacade {
    constructor(parent) {
      super(parent, new threeJsCameraClass())
      this._projectionChanged = false
    }

    afterUpdate() {
      // Projection changes require a projection matrix rebuild - see setters below
      if (this._projectionChanged) {
        this.threeObject.updateProjectionMatrix()
        this._projectionChanged = false
      }
      super.afterUpdate()
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
