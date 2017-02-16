import {PerspectiveCamera, OrthographicCamera} from 'three'
import Object3DFacade from './Object3D'


export function createCameraFacade(threeJsCameraClass, projectionProps) {
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
  projectionProps.forEach(prop => {
    Object.defineProperty(Camera3DFacade.prototype, prop, {
      set(val) {
        if (val !== this.threeObject[prop]) {
          this.threeObject[prop] = val
          this._projectionChanged = true
        }
      },
      get() {
        return this.threeObject[prop]
      }
    })
  })

  return Camera3DFacade
}


export const PerspectiveCamera3DFacade = createCameraFacade(PerspectiveCamera, ['fov', 'aspect', 'near', 'far'])
export const OrthographicCamera3DFacade = createCameraFacade(OrthographicCamera, ['left', 'right', 'top', 'bottom', 'near', 'far'])
