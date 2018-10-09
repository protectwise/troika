import { utils } from 'troika-core'
import { Scene, Fog, FogExp2, Sphere } from 'three'
import Object3DFacade from './Object3DFacade'
import InstancingManager from './instancing/InstancingManager'
import { AmbientLight3DFacade, SpotLight3DFacade, DirectionalLight3DFacade, PointLight3DFacade } from './Light3DFacade'


const LIGHT_TYPES = {
  ambient: AmbientLight3DFacade,
  directional: DirectionalLight3DFacade,
  spot: SpotLight3DFacade,
  point: PointLight3DFacade
}

const RAY_INTERSECTION = [{distance: Infinity}]
const INFINITE_SPHERE = new Sphere(undefined, Infinity)

class Scene3DFacade extends Object3DFacade {
  constructor(parent) {
    let scene = new Scene()
    // We always manually update world matrices when needed - see Object3DFacade.updateMatrices() -
    // so the additional autoUpdate pass done by threejs before render is not needed:
    scene.autoUpdate = false
    super(parent, scene)
  }

  afterUpdate() {
    let children = {
      key: 'instancingMgr',
      facade: InstancingManager,
      children: this.objects
    }

    // Map light definitions to their appropriate classes
    if (this.lights && this.lights.length) {
      let lights = this.lights.map((def, i) => {
        let realDef = utils.assign({}, def)
        delete realDef.type
        realDef.key = `$$$light_${ i }`
        realDef.facade = realDef.facade || LIGHT_TYPES[def.type]
        return realDef.facade ? realDef : null
      })
      children = lights.concat(children)
    }
    this.children = children

    super.afterUpdate()
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
