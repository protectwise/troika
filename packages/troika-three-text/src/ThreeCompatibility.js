/**
 * A module exposing the right classes for the current Three.js version used.
 */

import {
  REVISION,
  PlaneBufferGeometry,
  PlaneGeometry
} from 'three'

// The revision number was a string at some point (ex: in r103)
const version = Number(REVISION)

// Since r144, a warning is shown when a PlaneBufferGeometry is created
// See PR #24352, https://github.com/mrdoob/three.js/blob/a09adf3d96fdd508cdf46434fb071f05b84e7bce/src/Three.Legacy.js#L205
const planeGeometryClass = version >= 144 ? PlaneGeometry : PlaneBufferGeometry

export { planeGeometryClass as PlaneGeometry }
