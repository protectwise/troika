import {
  BoxBufferGeometry,
  Mesh,
  MeshPhongMaterial
} from 'three'
import { Object3DFacade } from 'troika-3d'

const sx = 40
const sy = 0.2
const sz = 40

const geometry = new BoxBufferGeometry(sx, sy, sz, 1, 1, 1)
const material = new MeshPhongMaterial({
  transparent: true,
  opacity: 0.2,
  color: 0xFFFFFF,
  refractionRatio: 1.0
})

export default class Ground extends Object3DFacade {
  constructor (parent) {
    const ground = new Mesh(geometry, material.clone())
    super(parent, ground)
  }

  set environmentMap (envMapTexture) {
    this.threeObject.material.envMap = envMapTexture
  }

  set color (c) {
    this.threeObject.material.color.set(c)
  }
}
