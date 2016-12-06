import omit from 'lodash/omit'
import {Scene as ThreeScene} from 'three'
import Object3D from './Object3D'
import {AmbientLight, SpotLight, DirectionalLight, PointLight} from './Light'


const LIGHT_TYPES = {
  ambient: AmbientLight,
  directional: DirectionalLight,
  spot: SpotLight,
  point: PointLight
}

const RAY_INTERSECTION = [{distance: Infinity}]


class Scene extends Object3D {
  constructor(parent) {
    let scene = new ThreeScene()

    super(parent, scene)
  }

  afterUpdate() {
    // Map light definitions to their appropriate classes
    let lights = (this.lights || [{type: 'ambient'}]).map((def, i) => {
      let realDef = omit(def, 'type')
      realDef.key = `$$$light_${ i }`
      realDef.class = LIGHT_TYPES[def.type] || AmbientLight
      return realDef
    })

    // Add the lights to the children
    this.children = lights.concat(this.children)

    super.afterUpdate()
  }

  raycast(raycaster) {
    // Scene will always intersect, but as the furthest from the camera
    return RAY_INTERSECTION
  }
}


export default Scene
