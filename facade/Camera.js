import THREE from 'three'
import Object3D from './Object3D'
import Transitionable from './Transitionable'

class Camera extends Object3D {
  constructor(parent) {
    super(parent, new THREE.PerspectiveCamera())
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
;['fov', 'aspect', 'near', 'far'].forEach(prop => {
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



export default Transitionable(Camera) //auto-enable transitions
