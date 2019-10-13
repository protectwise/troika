import { Object3DFacade } from 'troika-3d'
import { BezierMesh } from 'troika-three-utils'

const noDash = [0, 0]

/**
 * Facade wrapper around BezierMesh from three-troika-utils
 */
class Bezier3DFacade extends Object3DFacade {
  constructor(parent) {
    super(parent, new BezierMesh())
    this.radius = 0.01
    this.opacity = 1
    this.color = 0xffffff
    this.dashArray = [0, 0]
    this.dashOffset = 0
  }

  afterUpdate() {
    const {
      threeObject:obj,
      p1x, p1y, p1z,
      c1x, c1y, c1z,
      c2x, c2y, c2z,
      p2x, p2y, p2z,
      radius,
      dashArray,
      dashOffset,
      material,
      opacity,
      color
    } = this

    obj.pointA.set(p1x || 0, p1y || 0, p1z || 0)
    obj.controlA.set(c1x || 0, c1y || 0, c1z || 0)
    obj.controlB.set(c2x || 0, c2y || 0, c2z || 0)
    obj.pointB.set(p2x || 0, p2y || 0, p2z || 0)
    obj.radius = radius
    obj.dashArray.fromArray(dashArray || noDash)
    obj.dashOffset = dashOffset

    obj.material = material
    obj.material.opacity = opacity
    obj.material.transparent = opacity < 1
    obj.material.color.set(color)
    super.afterUpdate()
  }
}

export default Bezier3DFacade
