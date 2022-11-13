import {
  BoxGeometry,
  Mesh,
  MeshPhongMaterial,
  DoubleSide
} from 'three'
import {
  Object3DFacade
} from 'troika-3d'


const BOX_SIZE = 40

const geometry = new BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE)
const material = new MeshPhongMaterial({
  color: 0x003300,
  opacity: 0.6,
  side: DoubleSide,
  transparent: true
})

export default class Box extends Object3DFacade {
  initThreeObject() {
    return new Mesh(geometry, material)
  }
}
