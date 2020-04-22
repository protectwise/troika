import { utils } from 'troika-core'
import { DoubleSide, PlaneBufferGeometry } from 'three'
import { MeshFacade } from './MeshFacade.js'

const getGeometry = utils.memoize(() => {
  return new PlaneBufferGeometry(1, 1, 1, 1).rotateX(-Math.PI / 2)
})

/**
 * A simple rectangular plane, laying along the x-z plane, facing the positive y axis, centered on the origin.
 * The `width` property controls x scale and the `depth` property controls z scale.
 * To control the material, see {@link MeshFacade}.
 */
export class PlaneFacade extends MeshFacade {
  constructor (parent) {
    super(parent)
    this['material.side'] = this['material.shadowSide'] = DoubleSide
  }

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
