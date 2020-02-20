import { MeshFacade } from './MeshFacade.js'
import { getBoxGeometry } from './BoxFacade.js'

/**
 * A simple cube, centered on the origin.
 * The `size` property sets the uniform edge length. For non-uniform boxes, use {@link BoxFacade.js#Box}
 * To control the material, see {@link MeshFacade}.
 */
export class CubeFacade extends MeshFacade {
  get geometry() {
    return getBoxGeometry()
  }

  set size(size) {
    this.scale = size
  }
  get size() {
    return this.scale
  }
}
