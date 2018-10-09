import {
  Geometry,
  Line,
  LineBasicMaterial,
  Vector3
} from 'three'
import {
  Object3DFacade
} from 'troika-3d'


const POINTS = 128
const geometry = new Geometry()
for (let i = 0; i <= POINTS; i++) {
  let angle = Math.PI * 2 * i / POINTS
  geometry.vertices.push(
    new Vector3(Math.cos(angle), Math.sin(angle), 0)
  )
}

const material = new LineBasicMaterial({
  color: 0x333344
})

export default class Orbit extends Object3DFacade {
  constructor(parent) {
    super(parent, new Line(geometry, material))
  }

  set distance(d) {
    this.scaleX = this.scaleY = this.scaleZ = d
  }
}
