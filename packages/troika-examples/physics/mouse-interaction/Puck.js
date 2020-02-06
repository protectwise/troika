import {
  CylinderBufferGeometry,
  Mesh,
  MeshPhongMaterial,
  Color
} from 'three'
import { Instanceable3DFacade, Object3DFacade } from 'troika-3d'
import { extendAsPhysical } from 'troika-physics'

const RADIUS = 1
const HEIGHT = 0.5

const geometry = new CylinderBufferGeometry(RADIUS, RADIUS, HEIGHT, 20)
const material = new MeshPhongMaterial({
  transparent: true,
  opacity: 1.0,
  color: 0xFFFFFF,
  refractionRatio: 0.8
})

// const protoObj = new Mesh(geometry, material)
// class Puck extends Instanceable3DFacade {
//   constructor (parent) {
//     super(parent)
//     this.instancedThreeObject = protoObj
//   }

//   afterUpdate () {
//     // let { color, radius } = this
//     // if (this.hovered) color = 0xffffff
//     // if (color !== this._color) {
//     //   this.setInstanceUniform('diffuse', new Color(color))
//     //   this._color = color
//     // }
//     // if (radius !== this._radius) {
//     //   this.scaleX = this.scaleY = this.scaleZ = this._radius = radius
//     // }
//     super.afterUpdate()
//   }
// }

class Puck extends Object3DFacade {
  constructor (parent) {
    const mesh = new Mesh(geometry, material.clone())

    super(parent, mesh)
  }

  set color (c) {
    this.threeObject.material.color.set(c)
  }

  set environmentMap (envMapTexture) {
    this.threeObject.material.envMap = envMapTexture
  }
}

export default extendAsPhysical(Puck)
