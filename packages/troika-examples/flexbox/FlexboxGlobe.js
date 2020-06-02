import { Object3DFacade } from 'troika-3d'
import { extendAsFlexNode } from 'troika-3d-ui'
import { Mesh, MeshStandardMaterial, SphereBufferGeometry, TextureLoader } from 'three'

/**
 * A globe that participates in flexbox layout
 */
class FlexboxGlobe extends Object3DFacade {
  constructor(parent) {
    super(parent, new Mesh(
      new SphereBufferGeometry(0.5, 64, 64),
      new MeshStandardMaterial({
        map: new TextureLoader().load('globe/texture_day.jpg'),
        roughness: 0.5,
        metalness: 0.5,
        // Make the globes "poke through" their background layer:
        transparent: true,
        depthTest: false
      })
    ))
  }

  afterUpdate() {
    this.threeObject.visible = this.offsetWidth != null

    // Make it render right after its background layer but before sibling layers,
    // so it can "poke through" its background layer with depthTest:false, but not
    // through other layers.
    this.z = 0.001
    this.threeObject.renderOrder = this.flexNodeDepth

    // Center the globe within the layed out box
    let diameter = Math.min(this.clientWidth, this.clientHeight)
    this.x = this.offsetLeft + this.offsetWidth / 2
    this.y = -(this.offsetTop + this.offsetHeight / 2)
    this.scaleX = this.scaleY = this.scaleZ = diameter
    super.afterUpdate()
  }
}

export default extendAsFlexNode(FlexboxGlobe)
