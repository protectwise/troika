import { extendAsFlexNode } from '../flex-layout/FlexNode.js'
import { Mesh, MeshBasicMaterial, PlaneGeometry, TextureLoader } from 'three'
import { Object3DFacade } from 'troika-3d'


const geometry = new PlaneGeometry(1, 1).translate(0.5, -0.5, 0)
const defaultMaterial = new MeshBasicMaterial()
const loader = new TextureLoader()

class UIImage3DFacade extends Object3DFacade {
  constructor(parent, texture) {
    const mesh = new Mesh(geometry, defaultMaterial.clone())
    mesh.visible = false //hidden until image is ready
    super(parent, mesh)
  }

  afterUpdate() {
    const {offsetLeft, offsetTop, offsetWidth, offsetHeight, src, threeObject:mesh, transparent} = this
    const material = mesh.material
    const hasLayout = !!(offsetWidth && offsetHeight)
    if (hasLayout) {
      this.x = offsetLeft
      this.y = -offsetTop
      this.scaleX = offsetWidth
      this.scaleY = offsetHeight

      const depth = this.flexNodeDepth
      material.polygonOffset = !!depth
      material.polygonOffsetFactor = material.polygonOffsetUnits = -depth || 0
      mesh.renderOrder = depth
    }

    if (src !== this._lastSrc) {
      loader.load(src, texture => {
        if (material.map) {
          material.map.dispose()
        }
        material.map = texture
        if (transparent) material.transparent = true;
        this.aspectRatio = texture.image.width / texture.image.height
        this.afterUpdate()
        this.requestRender()
      })
      this._lastSrc = src
    }

    mesh.visible = !!(hasLayout && material.map && material.map.image.complete)

    super.afterUpdate()
  }

  destructor() {
    const texture = this.threeObject.material.map
    if (texture) {
      texture.dispose()
    }
    super.destructor()
  }
}

export default extendAsFlexNode(UIImage3DFacade)
