import {Mesh, DoubleSide, PlaneGeometry, MeshPhongMaterial} from 'three/src/Three'
import {Object3D} from '../../src/index'


const groundGeometry = new PlaneGeometry(1, 1)

const groundMaterial = new MeshPhongMaterial({
  color: 0x222222,
  side: DoubleSide
})

export default class Ground extends Object3D {
  constructor(parent) {
    let mesh = new Mesh(groundGeometry, groundMaterial)
    super(parent, mesh)
  }

  set width(w) {
    this.x = w / 2
    this.scaleX = w
  }
  get width() {
    return this.scaleX
  }

  set height(h) {
    this.y = h / 2
    this.scaleY = h
  }
  get height() {
    return this.scaleY
  }

  destructor() {
    super.destructor()
    // TODO dispose geometry/material?
  }
}

