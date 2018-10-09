import {
  SphereBufferGeometry,
  Mesh,
  MeshPhongMaterial
} from 'three'
import {
  Object3DFacade
} from 'troika-3d'


const geometry = new SphereBufferGeometry(1)
const material = new MeshPhongMaterial({
  color: 0x993333
})

export default class Dot extends Object3DFacade {
  constructor(parent) {
    super(parent, new Mesh(geometry, material))
  }
}
