import {
  SphereBufferGeometry,
  Mesh,
  MeshPhongMaterial
} from 'three'
import {
  Object3DFacade
} from 'troika-3d'


const geometry = new SphereBufferGeometry(1, 32, 32)
const material = new MeshPhongMaterial({
  transparent: true
})

export default class Planet extends Object3DFacade {
  initThreeObject() {
    return new Mesh(geometry, material.clone())
  }

  set radius(r) {
    this.scaleX = this.scaleY = this.scaleZ = r
  }
  get radius() {
    return this.scaleZ
  }

  set color(c) {
    this.threeObject.material.color.set(c)
  }

  set opacity(o) {
    this.threeObject.visible = o > 0
    this.threeObject.material.opacity = o
  }
}
