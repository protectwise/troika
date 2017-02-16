import {
  SphereBufferGeometry,
  Mesh,
  MeshBasicMaterial
} from 'three'
import {
  Object3DFacade
} from '../../src/index'


const geometry = new SphereBufferGeometry(2, 16, 16)
const material = new MeshBasicMaterial({
  color: 0xffffff
})

export default class Sun extends Object3DFacade {
  constructor(parent) {
    super(parent, new Mesh(geometry, material.clone()))
  }
}
