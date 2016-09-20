import {AmbientLight, DirectionalLight, SpotLight, PointLight} from 'three'
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


export const AmbientLight = createLightSubclass(AmbientLight)
export const DirectionalLight = createLightSubclass(DirectionalLight)
export const SpotLight = createLightSubclass(SpotLight)
export const PointLight = createLightSubclass(PointLight)
