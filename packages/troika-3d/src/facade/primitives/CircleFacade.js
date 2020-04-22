import { utils } from 'troika-core'
import { CircleBufferGeometry, DoubleSide } from 'three'
import { MeshFacade } from './MeshFacade.js'

const geometries = Object.create(null, [
  ['low', 32],
  ['medium', 64],
  ['high', 128]
].reduce((descr, [name, segments]) => {
  descr[name] = {
    get: utils.memoize(() =>
      new CircleBufferGeometry(1, segments).rotateX(-Math.PI / 2)
    )
  }
  return descr
}, {}))

export function getCircleGeometry(detail) {
  return geometries[detail] || geometries.medium
}

/**
 * A simple planar circle, laying along the x-z plane, facing the positive y axis, centered on the origin.
 * The `radius` property is an alias to uniform `scaleX` and `scaleZ`. Set `scaleX/Y/Z` individually if
 * you need non-uniform scaling.
 * The `detail` property allows selecting a LOD; its values can be 'low', 'medium', or 'high'.
 * To control the material, see {@link MeshFacade}.
 */
export class CircleFacade extends MeshFacade {
  constructor (parent) {
    super(parent)
    this['material.side'] = this['material.shadowSide'] = DoubleSide
  }

  get geometry() {
    return getCircleGeometry(this.detail)
  }

  set radius(r) {
    this.scaleX = this.scaleZ = r
  }
  get radius() {
    return this.scaleX
  }
}
