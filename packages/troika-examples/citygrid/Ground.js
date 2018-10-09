import {Mesh, DoubleSide, PlaneGeometry, MeshPhongMaterial} from 'three'
import {Object3DFacade} from 'troika-3d'


const groundGeometry = new PlaneGeometry(1, 1)

const groundMaterial = new MeshPhongMaterial({
  color: 0x222222,
  side: DoubleSide
})

export default class Ground extends Object3DFacade {
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

