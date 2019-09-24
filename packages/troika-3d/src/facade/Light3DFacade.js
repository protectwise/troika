import {
  AmbientLight,
  DirectionalLight,
  SpotLight,
  PointLight
} from 'three'
import Object3DFacade from './Object3DFacade'
import { utils } from 'troika-core'
//import {ShadowMapViewer} from 'three/examples/jsm/utils/ShadowMapViewer.js'


// Common superclass with setters for all possible light properties
class Light3DFacade extends Object3DFacade {
  set color(c) {
    this.threeObject.color.set(c)
  }

  // Shadow map configurable by deep object copy:
  get shadow() {
    return this.threeObject.shadow
  }
  set shadow(val) {
    utils.assignDeep(this.threeObject.shadow, val)
  }
}
// Setters for simple properties to be copied
['intensity', 'distance', 'angle', 'penumbra', 'decay', 'castShadow'].forEach(propName => {
  Object.defineProperty(Light3DFacade.prototype, propName, {
    get() {
      return this.threeObject[propName]
    },
    set(value) {
      this.threeObject[propName] = value
    }
  })
})


export function createLightFacade(ThreeJsLightClass) {
  return class extends Light3DFacade {
    constructor(parent) {
      super(parent, new ThreeJsLightClass())
      // const helper = new ShadowMapViewer(this.threeObject)
      // this.addEventListener('afterrender', (renderer) => {
      //   helper.render(renderer)
      // })
    }
  }
}

export const AmbientLight3DFacade = createLightFacade(AmbientLight)
export const DirectionalLight3DFacade = createLightFacade(DirectionalLight)
export const SpotLight3DFacade = createLightFacade(SpotLight)
export const PointLight3DFacade = createLightFacade(PointLight)
