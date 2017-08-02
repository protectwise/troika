import {
  SphereBufferGeometry,
  Mesh,
  MeshPhongMaterial
} from 'three'
import {
  Object3DFacade
} from '../../src/index'


// Common shared geometry
const geometry = new SphereBufferGeometry(1)

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



export default NonInstanceableSphere

