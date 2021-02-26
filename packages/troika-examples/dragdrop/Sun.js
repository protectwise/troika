import {
  SphereBufferGeometry,
  Mesh,
  MeshBasicMaterial
} from 'three'
import {
  Object3DFacade
} from 'troika-3d'


const geometry = new SphereBufferGeometry(.02, 16, 16)
const material = new MeshBasicMaterial({
  color: 0xffffff
})

export default class Sun extends Object3DFacade {
  initThreeObject() {
    return new Mesh(geometry, material.clone())
  }
}
