import THREE from 'three'
import Object3D from './Object3D'

// Common superclass with setters for all possible light properties
class Light extends Object3D {
  set color(c) {
    this.threeObject.color.set(c)
  }
}
// Setters for simple properties to be copied
['intensity', 'distance', 'angle', 'penumbra', 'decay'].forEach(propName => {
  Object.defineProperty(Light.prototype, propName, {
    get() {
      return this.threeObject[propName]
    },
    set(value) {
      this.threeObject[propName] = value
    }
  })
})


function createLightSubclass(ThreeJsLightClass) {
  return class extends Light {
    constructor(parent) {
      super(parent, new ThreeJsLightClass())
    }
  }
}


export const AmbientLight = createLightSubclass(THREE.AmbientLight)
// export const DirectionalLight = createLightSubclass(THREE.DirectionalLight)
// DirectionalLight.prototype.afterUpdate = function() {
//   this.threeObject.position.normalize()
//   super.afterUpdate()
// }
export class DirectionalLight extends Light {
  constructor(parent) {
    super(parent, new THREE.DirectionalLight())
  }

  afterUpdate() {
    this.threeObject.position.normalize()
    super.afterUpdate()
  }
}
export const SpotLight = createLightSubclass(THREE.SpotLight)
export const PointLight = createLightSubclass(THREE.PointLight)
