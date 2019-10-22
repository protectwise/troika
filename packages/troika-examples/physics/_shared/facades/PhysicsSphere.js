import {
  SphereBufferGeometry,
  Mesh,
  MeshPhongMaterial
} from 'three'
import { extendAsPhysical } from 'troika-physics'
import { Object3DFacade } from 'troika-3d'

const DEFAULT_RADIUS = 1

const material = new MeshPhongMaterial({
  transparent: true,
  opacity: 1.0
})

class Sphere extends Object3DFacade {
  constructor (parent) {
    const geometry = new SphereBufferGeometry(DEFAULT_RADIUS, 32, 32) // Unique geometry to allow Soft Body demo to modify the vertices without affecting other demos
    const mesh = new Mesh(geometry, material.clone())
    super(parent, mesh)
  }

  set radius (r) {
    this.scaleX = this.scaleY = this.scaleZ = r
  }

  get radius () {
    return this.scaleZ
  }

  get color () {
    return this.threeObject.material.color.getHex()
  }

  set color (c) {
    this.threeObject.material.color.set(c)
  }

  set opacity (o) {
    this.threeObject.visible = o > 0
    this.threeObject.material.opacity = o
  }
}

export default extendAsPhysical(Sphere)
