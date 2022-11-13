import {
  SphereGeometry,
  Mesh,
  MeshPhongMaterial, Color
} from 'three'
import {
  Object3DFacade
} from 'troika-3d'


// Common shared geometry
const geometry = new SphereGeometry(1)

class NonInstanceableSphere extends Object3DFacade {
  initThreeObject() {
    return new Mesh(geometry, new MeshPhongMaterial())
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

