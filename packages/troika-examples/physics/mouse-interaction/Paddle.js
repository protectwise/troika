import {
  CylinderBufferGeometry,
  Mesh,
  MeshPhongMaterial
} from 'three'
import { Object3DFacade } from 'troika-3d'
import { extendAsPhysical } from 'troika-physics'

const RADIUS = 1.2
const HEIGHT = 1

const geometry = new CylinderBufferGeometry(RADIUS, RADIUS, HEIGHT, 20)
const material = new MeshPhongMaterial({
  transparent: true,
  opacity: 1.0,
  color: 0xFFFFFF,
  refractionRatio: 0.8
})

class Paddle extends Object3DFacade {
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

export default extendAsPhysical(Paddle)
