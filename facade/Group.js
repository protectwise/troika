import THREE from 'three'
import Object3D from './Object3D'


export default class Group extends Object3D {
  constructor(parent) {
    super(parent, new THREE.Group())
  }
}
