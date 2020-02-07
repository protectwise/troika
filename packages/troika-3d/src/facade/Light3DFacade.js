import {
  AmbientLight,
  DirectionalLight,
  SpotLight,
  PointLight,
  HemisphereLight,
  RectAreaLight,
  DirectionalLightHelper,
  HemisphereLightHelper,
  PointLightHelper,
  SpotLightHelper
} from 'three'
import Object3DFacade from './Object3DFacade.js'
import { utils } from 'troika-core'
//import {ShadowMapViewer} from 'three/examples/jsm/utils/ShadowMapViewer.js'


// Common superclass with setters for all possible light properties
class Light3DFacade extends Object3DFacade {
  set color(c) {
    this.threeObject.color.set(c)
  }
  get color() {
    return this.threeObject.color.getHex()
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
['intensity', 'distance', 'angle', 'penumbra', 'decay', 'castShadow', 'width', 'height'].forEach(propName => {
  Object.defineProperty(Light3DFacade.prototype, propName, {
    get() {
      return this.threeObject[propName]
    },
    set(value) {
      this.threeObject[propName] = value
    }
  })
})


export function createLightFacade(ThreeJsLightClass, HelperClass, customProtoDefs) {
  const Cls = class extends Light3DFacade {
    constructor(parent) {
      super(parent, new ThreeJsLightClass())
    }
    set showHelper(showHelper) {
      let helper = this._helper
      if (!!showHelper !== !!helper) {
        if (showHelper) {
          this.threeObject.add(this._helper = new HelperClass(this.threeObject))
        } else if (helper) {
          helper.dispose()
          this.threeObject.remove(helper)
          this._helper = null
        }
      }
    }
    afterUpdate () {
      super.afterUpdate()
      if (this._helper) {
        this._helper.update()
      }
    }
  }
  if (customProtoDefs) {
    Object.defineProperties(Cls.prototype, customProtoDefs)
  }
  return Cls
}

export const AmbientLight3DFacade = createLightFacade(AmbientLight)
export const DirectionalLight3DFacade = createLightFacade(DirectionalLight, DirectionalLightHelper)
export const SpotLight3DFacade = createLightFacade(SpotLight, SpotLightHelper)
export const PointLight3DFacade = createLightFacade(PointLight, PointLightHelper)
export const HemisphereLight3DFacade = createLightFacade(HemisphereLight, HemisphereLightHelper, {
  groundColor: {
    set(c) {
      this.threeObject.groundColor.set(c)
    },
    get() {
      return this.threeObject.groundColor.getHex()
    }
  }
})
export const RectAreaLight3DFacade = createLightFacade(RectAreaLight)
