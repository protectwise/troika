import { utils } from 'troika-core'
import { SphereBufferGeometry } from 'three'
import { MeshFacade } from './MeshFacade.js'

function createGeometry(widthSegments, heightSegments) {
  return new SphereBufferGeometry(1, widthSegments, heightSegments)
}

const geometries = Object.create(null, {
  low: {
    get: utils.memoize(() => createGeometry(16, 12))
  },
  medium: {
    get: utils.memoize(() => createGeometry(32, 24))
  },
  high: {
    get: utils.memoize(() => createGeometry(64, 48))
  }
})

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
