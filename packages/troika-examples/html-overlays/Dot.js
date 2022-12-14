import {
  SphereGeometry,
  Mesh,
  MeshPhongMaterial
} from 'three'
import {
  Object3DFacade
} from 'troika-3d'


const geometry = new SphereGeometry(1)
const material = new MeshPhongMaterial({
  color: 0x993333
})

export default class Dot extends Object3DFacade {
  initThreeObject() {
    return new Mesh(geometry, material)
  }
}
