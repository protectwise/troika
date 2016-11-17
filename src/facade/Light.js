import {
  AmbientLight as ThreeAmbientLight,
  DirectionalLight as ThreeDirectionalLight,
  SpotLight as ThreeSpotLight,
  PointLight as ThreePointLight
} from 'three'
import Object3D from './Object3D'

// Common superclass with setters for all possible light properties
class Light extends Object3D {
  set color(c) {
    this.threeObject.color.set(c)
  }
}
// Setters for simple properties to be copied
['intensity', 'distance', 'angle', 'penumbra', 'decay', 'castShadow'].forEach(propName => {
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


export const AmbientLight = createLightSubclass(ThreeAmbientLight)
export const DirectionalLight = createLightSubclass(ThreeDirectionalLight)
export const SpotLight = createLightSubclass(ThreeSpotLight)
export const PointLight = createLightSubclass(ThreePointLight)
