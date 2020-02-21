import { utils } from 'troika-core'
import { SphereBufferGeometry } from 'three'
import { MeshFacade } from './MeshFacade.js'

const geometries = Object.create(null, [
  ['low', 16, 12],
  ['medium', 32, 24],
  ['high', 64, 48]
].reduce((descr, [name, wSegs, hSegs]) => {
  descr[name] = {
    get: utils.memoize(() => new SphereBufferGeometry(1, wSegs, hSegs))
  }
  return descr
}, {}))

export function getSphereGeometry(detail) {
  return geometries[detail] || geometries.medium
}

/**
 * A simple sphere, centered on the origin.
 * The `radius` property is an alias to the uniform `scale`. Set `scaleX/Y/Z` individually if
 * you need non-uniform scaling.
 * The `detail` property allows selecting a LOD; its values can be 'low', 'medium', or 'high'.
 * To control the material, see {@link MeshFacade}.
 */
export class SphereFacade extends MeshFacade {
  get geometry() {
    return getSphereGeometry(this.detail)
  }

  set radius(r) {
    this.scale = r
  }
  get radius() {
    return this.scale
  }
}
