import {
  SphereBufferGeometry,
  Mesh,
  MeshPhongMaterial
} from 'three'
import {
  Object3DFacade,
  Instanceable3DFacade
} from '../../src/index'



// Common shared geometry

const geometry = new SphereBufferGeometry(1)
console.log(`each object has ${geometry.attributes.position.array.length} vertices`)



// Instanceable facade using a single shared Mesh per color

const instancingProtos = {}

class InstanceableSphere extends Instanceable3DFacade {
  set color(color) {
    if (color !== this._color) {
      this.instancedThreeObject = instancingProtos[color] || (
        instancingProtos[color] = new Mesh(geometry, new MeshPhongMaterial({color: color}))
      )
      this._color = color
    }
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
    super(parent, new Mesh(geometry))
  }

  set color(color) {
    if (color !== this._color) {
      this.threeObject.material = nonInstancingMaterials[color] || (
        nonInstancingMaterials[color] = new MeshPhongMaterial({color: color})
      )
      this._color = color
    }
  }

  set radius(r) {
    if (r !== this._radius) {
      this.scaleX = this.scaleY = this.scaleZ = this._radius = r
    }
  }
  get radius() {return this._radius}
}



export {InstanceableSphere, NonInstanceableSphere}

