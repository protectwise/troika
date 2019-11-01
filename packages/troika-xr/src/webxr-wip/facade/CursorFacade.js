import { Mesh, MeshBasicMaterial, SphereBufferGeometry } from 'three'
import {Object3DFacade} from 'troika-3d'

const cursorGeom = new SphereBufferGeometry()
const cursorMaterial = new MeshBasicMaterial({color: 0xffffff})

class CursorFacade extends Object3DFacade {
  constructor(parent) {
    super(parent, new Mesh(
      cursorGeom,
      cursorMaterial.clone()
    ))

    // TODO set scale on each intersection to maintain uniform visible size regardless of distance?
    this.scale = 0.005
  }

  afterUpdate() {
    const {rayIntersection} = this

    // Only display if there is a valid ray intersection
    if (rayIntersection && rayIntersection.point) {
      rayIntersection.point.copy.call(this, rayIntersection.point)
      this.visible = true
    } else {
      this.visible = false
    }

    super.afterUpdate()
  }
}

export default CursorFacade
