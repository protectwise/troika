import { Mesh, MeshBasicMaterial, SphereBufferGeometry } from 'three'
import Object3DFacade from '../Object3DFacade'

const cursorGeom = new SphereBufferGeometry()
const cursorMtl = new MeshBasicMaterial({color: 0xffffff})

class CursorFacade extends Object3DFacade {
  constructor(parent) {
    super(parent, new Mesh(cursorGeom, cursorMtl))
  }

  afterUpdate() {
    // TODO update scale to maintain uniform visible size regardless of distance
    this.scale = 0.0025
    super.afterUpdate()
  }
}

export default CursorFacade
