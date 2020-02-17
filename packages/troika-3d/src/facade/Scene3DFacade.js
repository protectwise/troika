import { utils } from 'troika-core'
import { Scene, Fog, FogExp2, Sphere } from 'three'
import Object3DFacade from './Object3DFacade.js'
import InstancingManager from './instancing/InstancingManager.js'
import { AmbientLight3DFacade, SpotLight3DFacade, DirectionalLight3DFacade, PointLight3DFacade, HemisphereLight3DFacade } from './Light3DFacade.js'


const LIGHT_TYPES = {
  ambient: AmbientLight3DFacade,
  directional: DirectionalLight3DFacade,
  spot: SpotLight3DFacade,
  point: PointLight3DFacade,
  hemisphere: HemisphereLight3DFacade
}

const RAY_INTERSECTION = [{distance: Infinity}]
const INFINITE_SPHERE = new Sphere(undefined, Infinity)
const tempArr = [null]

class Scene3DFacade extends Object3DFacade {
  constructor(parent) {
    let scene = new Scene()
    // We always manually update world matrices when needed - see Object3DFacade.updateMatrices() -
    // so the additional autoUpdate pass done by threejs before render is not needed:
    scene.autoUpdate = false
    super(parent, scene)
  }

  describeChildren() {
    // Add root instancing manager
    let children = {
      key: 'instancingMgr',
      facade: InstancingManager,
      children: this.objects
    }

    // Map light definitions to their appropriate classes
    let {lights} = this
    if (lights) {
      children = [children]
      if (!Array.isArray(lights)) {
        tempArr[0] = lights
        lights = tempArr
      }
      lights.forEach((def, i) => {
        let facade = def.facade || LIGHT_TYPES[def.type]
        if (typeof facade === 'function') {
          let realDef = utils.assign({}, def)
          delete realDef.type
          realDef.key = def.key || `light${ i }`
          realDef.facade = facade
          children.push(realDef)
        }
      })
    }

    return children
  }

  set fog(def) {
    let fogObj = this._fogObj
    if (def) {
      let isExp2 = 'density' in def
      let fogClass = isExp2 ? FogExp2 : Fog
      if (!fogObj || !(fogObj instanceof fogClass)) {
        fogObj = this._fogObj = new fogClass()
      }
      fogObj.color.set(def.color)
      if (isExp2) {
        fogObj.density = def.density
      } else {
        fogObj.near = def.near
        fogObj.far = def.far
      }
    } else {
      fogObj = this._fogObj = null
    }
    this.threeObject.fog = fogObj
  }

  getBoundingSphere() {
    return INFINITE_SPHERE
  }

  raycast(raycaster) {
    // Scene3DFacade will always intersect, but as the furthest from the camera
    return RAY_INTERSECTION
  }
}


export default Scene3DFacade
