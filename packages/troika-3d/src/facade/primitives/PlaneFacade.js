import { utils } from 'troika-core'
import { PlaneBufferGeometry } from 'three'
import { MeshFacade } from './MeshFacade.js'

const getGeometry = utils.memoize(() => {
  return new PlaneBufferGeometry(1, 1, 1, 1).rotateX(Math.PI / 2)
})

/**
 * A simple rectangular plane that lays along the x-z plane, facing up, centered on the origin.
 * The `width` property controls x scale and the `depth` property controls z scale.
 * To control the material, see {@link MeshFacade}.
 */
export class PlaneFacade extends MeshFacade {
  get geometry() {
    return getGeometry()
  }

  set width(width) {
    this.scaleX = width
  }
  get width() {
    return this.scaleX
  }

  set depth(width) {
    this.scaleZ = width
  }
  get depth() {
    return this.scaleZ
  }
}
