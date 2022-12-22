import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
} from 'three'
import {
  Object3DFacade
} from 'troika-3d'


const POINTS = 128
const geometry = new BufferGeometry()
const positions = new BufferAttribute(new Float32Array((POINTS + 1) * 3), 3)
for (let i = 0; i <= POINTS; i++) {
  let angle = Math.PI * 2 * i / POINTS
  positions.setXYZ(i, Math.cos(angle), Math.sin(angle), 0)
}
geometry.setAttribute('position', positions)

const material = new LineBasicMaterial({
  color: 0x333344
})

export default class Orbit extends Object3DFacade {
  initThreeObject() {
    return new Line(geometry, material)
  }

  set distance(d) {
    this.scaleX = this.scaleY = this.scaleZ = d
  }
}
