import {PerspectiveCamera as ThreePerspective, OrthographicCamera as ThreeOrthographic} from 'three/src/Three'
import Object3D from './Object3D'


function createCameraSubclass(threeJsCameraClass, projectionProps) {
  class Camera extends Object3D {
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
    Object.defineProperty(Camera.prototype, prop, {
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

  return Camera
}


export const PerspectiveCamera = createCameraSubclass(ThreePerspective, ['fov', 'aspect', 'near', 'far'])
export const OrthographicCamera = createCameraSubclass(ThreeOrthographic, ['left', 'right', 'top', 'bottom', 'near', 'far'])
