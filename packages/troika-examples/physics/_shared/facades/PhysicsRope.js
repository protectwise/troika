import {
  BufferGeometry,
  LineBasicMaterial,
  BufferAttribute,
  LineSegments
} from 'three'
import { extendAsPhysical } from 'troika-physics'
import { Object3DFacade } from 'troika-3d'

const SEGS = 20

const material = new LineBasicMaterial({
  transparent: true,
  opacity: 1.0
})

class Rope extends Object3DFacade {
  constructor (parent) {
    const geometry = new BufferGeometry() // Unique geometry to allow Soft Body demo to modify the vertices without affecting other demos

    const LEN = 5
    var segmentLength = LEN / SEGS
    var ropePositions = []
    var ropeIndices = []

    const x = 0
    const y = 5
    const z = 0

    for (let i = 0; i < SEGS + 1; i++) {
      ropePositions.push(x, y + i * segmentLength, z)
    }

    for (let i = 0; i < SEGS; i++) {
      ropeIndices.push(i, i + 1)
    }
    geometry.setIndex(new BufferAttribute(new Uint16Array(ropeIndices), 1))
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(ropePositions), 3))
    geometry.computeBoundingSphere()

    const mesh = new LineSegments(geometry, material)

    super(parent, mesh)
  }

  get color () {
    return this.threeObject.material.color.getHex()
  }

  set color (c) {
    this.threeObject.material.color.set(c)
  }

  set opacity (o) {
    this.threeObject.visible = o > 0
    this.threeObject.material.opacity = o
  }
}

export default extendAsPhysical(Rope)
