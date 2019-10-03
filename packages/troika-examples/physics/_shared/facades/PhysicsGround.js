import {
  BoxGeometry,
  Mesh,
  MeshPhongMaterial
} from 'three'
import { Object3DFacade } from 'troika-3d'
import { extendAsPhysical } from 'troika-physics'

const sx = 20
const sy = 1
const sz = 20

const geometry = new BoxGeometry(sx, sy, sz, 1, 1, 1)
const material = new MeshPhongMaterial({
  transparent: true,
  opacity: 0.8,
  color: 0xFFFFFF,
  refractionRatio: 0.8
})

class Ground extends Object3DFacade {
  constructor (parent) {
    const ground = new Mesh(geometry, material.clone())
    super(parent, ground)
  }

  set opacity (o) {
    this.threeObject.material.opacity = o
  }

  set color (c) {
    this.threeObject.material.color.set(c)
  }

  set environmentMap (envMapTexture) {
    this.threeObject.material.envMap = envMapTexture
  }
}

export default extendAsPhysical(Ground)
