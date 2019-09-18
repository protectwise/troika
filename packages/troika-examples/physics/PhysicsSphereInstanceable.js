import {
  SphereBufferGeometry,
  Mesh,
  MeshPhongMaterial,
  Color
} from 'three'
import { Instanceable3DFacade } from 'troika-3d'
import { extendAsPhysical } from 'troika-physics'

const DEFAULT_RADIUS = 1

// Common shared geometry
const geometry = new SphereBufferGeometry(DEFAULT_RADIUS, 16, 16)

// Common shared material, declaring the diffuse color as an instanceable uniform
const material = new MeshPhongMaterial()
material.instanceUniforms = ['diffuse']

// Single mesh shared between all instanceables
const protoObj = new Mesh(geometry, material)

class InstanceableSphere extends Instanceable3DFacade {
  constructor (parent) {
    super(parent)
    this.instancedThreeObject = protoObj
  }

  afterUpdate () {
    let { color, radius } = this
    if (this.hovered) color = 0xffffff
    if (color !== this._color) {
      this.setInstanceUniform('diffuse', new Color(color))
      this._color = color
    }
    if (radius !== this._radius) {
      this.scaleX = this.scaleY = this.scaleZ = this._radius = radius
    }
    super.afterUpdate()
  }
}

export default extendAsPhysical(InstanceableSphere)
