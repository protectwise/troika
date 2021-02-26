import { Object3DFacade, Group3DFacade } from 'troika-3d'
import { extendAsFlexNode } from 'troika-3d-ui'
import { Mesh, MeshStandardMaterial, SphereBufferGeometry } from 'three'


let geom


class Globe extends Object3DFacade {
  initThreeObject() {
    return new Mesh(
      geom || (geom = new SphereBufferGeometry(0.5, 64, 64)),
      new MeshStandardMaterial({
        roughness: 0.5,
        metalness: 0.5
      })
    )
  }

  set texture(val) {
    if (val !== this._texture) {
      this._texture = val
      const material = this.threeObject.material
      if (material.map) {
        material.map.dispose()
      }
      material.map = val
    }
  }
}


class FlexboxGlobe extends Group3DFacade {
  constructor(parent) {
    super(parent)
    this._childDef = {
      facade: Globe
    }
  }

  afterUpdate() {
    const childDef = this._childDef
    this.children = this.offsetWidth == null ? null : childDef

    // Center the globe within the layed out box
    this.x = this.offsetLeft + this.offsetWidth / 2
    this.y = -(this.offsetTop + this.offsetHeight / 2)
    childDef.scale = Math.min(this.clientWidth, this.clientHeight)
    childDef.texture = this.texture
    super.afterUpdate()
  }
}

export default extendAsFlexNode(FlexboxGlobe)
