import {
  SphereBufferGeometry,
  Mesh,
  MeshPhongMaterial, Color
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

  afterUpdate() {
    let {color, radius} = this
    if (this.hovered) color = 0xffffff
    if (color !== this._color) {
      this.threeObject.material.color.set(color)
      this._color = color
    }
    if (radius !== this._radius) {
      this.scaleX = this.scaleY = this.scaleZ = this._radius = radius
    }
    super.afterUpdate()
  }

}



export default NonInstanceableSphere

