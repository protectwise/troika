import {
  CylinderBufferGeometry,
  Mesh,
  MeshPhongMaterial,
  Color
} from 'three'
import { Instanceable3DFacade } from 'troika-3d'
import { extendAsPhysical } from 'troika-physics'

const RADIUS = 1
const HEIGHT = 0.5

const geometry = new CylinderBufferGeometry(RADIUS, RADIUS, HEIGHT, 20)
const material = new MeshPhongMaterial({
  color: 0xFFFFFF
})
material.instanceUniforms = ['diffuse']
const puck = new Mesh(geometry, material)

class Puck extends Instanceable3DFacade {
  constructor (parent) {
    super(parent)
    this.instancedThreeObject = puck
  }

  set color (c) {
    if (!this._color !== c) {
      this.setInstanceUniform('diffuse', new Color(c))
    }
    this._color = c
  }
}

export default extendAsPhysical(Puck)
