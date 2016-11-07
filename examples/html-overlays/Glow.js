import {
  Mesh,
  MeshBasicMaterial,
  BackSide
} from 'three'
import {
  Object3D
} from '../../src/index'


export default class Glow extends Object3D {
  constructor(parent) {
    super(parent, new Mesh(
      parent.threeObject.geometry,
      new MeshBasicMaterial({
        color: 0xffffff,
        opacity: 0,
        side: BackSide,
        transparent: true
      })
    ))
  }

  set amount(val) {
    if (val !== this._amount) {
      this.scaleX = this.scaleY = this.scaleZ = 1 + val
      this._amount = val
    }
  }
  get amount() {
    return this._amount
  }

  set opacity(o) {
    this.threeObject.material.opacity = o
  }
  get opacity() {
    return this.threeObject.material.opacity
  }
}
