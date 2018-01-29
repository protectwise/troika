import {Mesh, ShaderMaterial, BoxBufferGeometry, Color, Sphere, Vector3} from 'three'
import {Object3DFacade} from '../../src/index'
import arcVertexShader from './arcVertexShader.glsl'
import arcFragmentShader from './arcFragmentShader.glsl'

const baseColor = new Color(0x3ba7db)
const highlightColor = new Color(0xffffff)

const baseGeometry = new BoxBufferGeometry(1, 1, 1, 16, 1, 1)

const baseMaterial = new ShaderMaterial({
  uniforms: {
    color: { type: 'c', value: baseColor },
    opacity: { type: 'f', value: 1 },
    startAngle: { type: 'f', value: 0 },
    endAngle: { type: 'f', value: Math.PI / 2 },
    startRadius: { type: 'f', value: 10 },
    endRadius: { type: 'f', value: Math.PI / 20 }
  },
  vertexShader: arcVertexShader,
  fragmentShader: arcFragmentShader,
  transparent: true
})

const infiniteSphere = new Sphere(new Vector3(), Infinity)


export default class Arc extends Object3DFacade {
  constructor(parent) {
    let mesh = new Mesh(
      baseGeometry,
      baseMaterial.clone()
    )
    super(parent, mesh)
  }

  afterUpdate() {
    let uniforms = this.threeObject.material.uniforms
    uniforms.startAngle.value = this.startAngle
    uniforms.endAngle.value = this.endAngle
    uniforms.startRadius.value = this.startRadius
    uniforms.endRadius.value = this.endRadius
    uniforms.opacity.value = this.opacity
    uniforms.color.value = this.highlight ? highlightColor : baseColor
    super.afterUpdate()
  }

  /**
   * Override getBoundingSphere method to handle vertex shader transformation
   *
   * Notice that for simplicity we just provide an infinite bounding sphere, essentially
   * bypassing the bounding sphere prefilter and triggering full raycast of all arcs.
   * This lets us avoid having to track changes to the angle/radius uniform props, and we
   * can get away with it because the total number of objects in this scene is small enough
   * that we can just raycast all of them without a bounding sphere prefilter. If that weren't
   * the case, you'd need to make this sphere more tightly wrapped to the actual arc, and then
   * in `afterUpdate` you'd need to test whether any of the angle/radius props was changed and
   * if so send a `this.notifyWorld('object3DBoundsChanged')` message so the raycasting
   * octree gets updated.
   */
  getBoundingSphere() {
    return infiniteSphere
  }

  /**
   * Override raycast method to handle vertex shader transformation
   */
  raycast(raycaster) {
    let {startAngle, endAngle, startRadius, endRadius, threeObject} = this
    let origGeom = threeObject.geometry
    let raycastGeometry = origGeom.clone()

    // Modify raycasting geometry to match what the vertex shader would produce
    let posAttr = raycastGeometry.attributes.position
    for (let i = 0; i < posAttr.count; i++) {
      let angle = endAngle + ((posAttr.getX(i) + 0.5) * (startAngle - endAngle));
      let radius = startRadius + ((posAttr.getY(i) + 0.5) * (endRadius - startRadius));
      posAttr.setXY(i, Math.cos(angle) * radius, Math.sin(angle) * radius)
    }
    raycastGeometry.computeBoundingSphere()

    // Temporarily replace geometry with the modified one
    threeObject.geometry = raycastGeometry
    let result = super.raycast(raycaster)
    threeObject.geometry = origGeom
    return result
  }
}
