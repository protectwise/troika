import {
  SphereBufferGeometry,
  Mesh,
  MeshPhongMaterial,
  Color,
} from 'three'
import {
  Instanceable3DFacade
} from '../../src/index'



// Common shared geometry
const geometry = new SphereBufferGeometry(1)

// Common shared material, declaring the diffuse color as an instanceable uniform
let material = new MeshPhongMaterial()
material.instanceUniforms = ['diffuse']

// Single mesh shared between all instanceables
const protoObj = new Mesh(geometry, material)





class InstanceableSphere extends Instanceable3DFacade {
  constructor(parent) {
    super(parent)
    this.instancedThreeObject = protoObj
  }

  set color(color) {
    if (color !== this._color) {
      this.setInstanceUniform('diffuse', new Color(color))
      this._color = color
    }
  }
  get color() {
    return this._color
  }

  set radius(r) {
    if (r !== this._radius) {
      this.scaleX = this.scaleY = this.scaleZ = this._radius = r
      this._radius = r
    }
  }
  get radius() {return this._radius}
}



export default InstanceableSphere

