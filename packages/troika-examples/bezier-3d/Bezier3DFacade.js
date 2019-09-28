import { Object3DFacade } from 'troika-3d'
import { CylinderBufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { createBezierMaterial } from './BezierMaterial'

const geometry = new CylinderBufferGeometry(1, 1, 1, 6, 64).translate(0, 0.5, 0)

const material = createBezierMaterial(
  new MeshStandardMaterial({side: DoubleSide, roughness: 0.8})
  // new MeshBasicMaterial({
  //   transparent: true,
  //   opacity: 0.5,
  //   color: '#66ccff'
  // })
)

class Bezier3DFacade extends Object3DFacade {
  constructor(parent) {
    const mtl = material.clone()
    super(parent, new Mesh(geometry, mtl))
    this.threeObject.customDepthMaterial = mtl.getDepthMaterial().clone()
    this.radius = 0.01
    this.opacity = 1
    this.color = 0x66ccff
  }

  afterUpdate() {
    const {material, customDepthMaterial} = this.threeObject
    this.updateUniforms(material)
    if (this.castShadow) {
      this.updateUniforms(customDepthMaterial)
    }
    material.opacity = this.opacity
    material.transparent = material.opacity < 1
    material.color.set(this.color)
    super.afterUpdate()
  }

  updateUniforms(mtl) {
    const uniforms = mtl.uniforms
    const {p1x, p1y, p1z, c1x, c1y, c1z, c2x, c2y, c2z, p2x, p2y, p2z} = this
    uniforms.pointA.value.set(p1x || 0, p1y || 0, p1z || 0)
    uniforms.controlA.value.set(c1x || 0, c1y || 0, c1z || 0)
    uniforms.controlB.value.set(c2x || 0, c2y || 0, c2z || 0)
    uniforms.pointB.value.set(p2x || 0, p2y || 0, p2z || 0)
    uniforms.radius.value = this.radius
  }
}

export default Bezier3DFacade
