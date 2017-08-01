import {
  SphereBufferGeometry,
  Mesh,
  MeshPhongMaterial,
  Color
} from 'three'
import {
  Object3DFacade,
  Instanceable3DFacade
} from '../../src/index'



// Common shared geometry

const geometry = new SphereBufferGeometry(1)
console.log(`each object has ${geometry.attributes.position.array.length} vertices`)



// Instanceable facade using a single shared Mesh per color

let material = new MeshPhongMaterial()
material.instanceUniforms = ['diffuse']
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
    }
  }
  get radius() {return this._radius}
}



// Non-instanceable facade using a shared material per color

const nonInstancingMaterials = {}

class NonInstanceableSphere extends Object3DFacade {
  constructor(parent) {
    super(parent, new Mesh(geometry, new MeshPhongMaterial()))
  }

  set color(color) {
    if (color !== this._color) {
      this.threeObject.material.color.set(color)
      this._color = color
    }
  }
  get color() {
    return this._color
  }

  set radius(r) {
    if (r !== this._radius) {
      this.scaleX = this.scaleY = this.scaleZ = this._radius = r
    }
  }
  get radius() {return this._radius}
}



export {InstanceableSphere, NonInstanceableSphere}

