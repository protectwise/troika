import { utils } from 'troika-core'
import { BoxBufferGeometry } from 'three'
import { MeshFacade } from './MeshFacade.js'

/**
 * Return a singleton instance of a 1x1x1 BoxBufferGeometry
 * @type {function(): BoxBufferGeometry}
 */
export const getBoxGeometry = utils.memoize(() => {
  return new BoxBufferGeometry(1, 1, 1, 1, 1)
})


/**
 * A simple box, centered on the origin.
 * The `width` property controls x scale, the `height` property controls y scale, and the `depth`
 * property controls z scale.
 * To control the material, see {@link MeshFacade}.
 */
export class BoxFacade extends MeshFacade {
  get geometry() {
    return getBoxGeometry()
  }

  set width(width) {
    this.scaleX = width
  }
  get width() {
    return this.scaleX
  }

  set height(height) {
    this.scaleY = height
  }
  get height() {
    return this.scaleY
  }

  set depth(width) {
    this.scaleZ = width
  }
  get depth() {
    return this.scaleZ
  }
}
