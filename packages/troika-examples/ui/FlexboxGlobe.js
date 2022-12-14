import { Object3DFacade } from 'troika-3d'
import { extendAsFlexNode } from 'troika-3d-ui'
import { Mesh, MeshStandardMaterial, SphereGeometry, TextureLoader } from 'three'


class FlexboxGlobe extends Object3DFacade {
  initThreeObject() {
    return new Mesh(
      new SphereGeometry(0.5, 64, 64),
      new MeshStandardMaterial({
        map: new TextureLoader().load('globe/texture_day.jpg'),
        roughness: 0.5,
        metalness: 0.5
      })
    )
  }

  afterUpdate() {
    this.threeObject.visible = this.offsetWidth != null

    // Center the globe within the layed out box
    this.x = this.offsetLeft + this.offsetWidth / 2
    this.y = -(this.offsetTop + this.offsetHeight / 2)
    this.scaleX = this.scaleY = this.scaleZ = Math.min(this.clientWidth, this.clientHeight)
    super.afterUpdate()
  }
}

export default extendAsFlexNode(FlexboxGlobe)
