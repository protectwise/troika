import {Mesh, ShaderMaterial, PlaneBufferGeometry, Color} from 'three/src/Three'
import {Object3D} from '../../src/index'
import arcVertexShader from './arcVertexShader.glsl'
import arcFragmentShader from './arcFragmentShader.glsl'


const baseGeometry = new PlaneBufferGeometry(1, 1, 16, 1)

const baseMaterial = new ShaderMaterial({
  uniforms: {
    color: { type: 'c', value: new Color(0x3ba7db) },
    startAngle: { type: 'f', value: 0 },
    endAngle: { type: 'f', value: Math.PI / 2 },
    startRadius: { type: 'f', value: 10 },
    endRadius: { type: 'f', value: Math.PI / 20 }
  },
  vertexShader: arcVertexShader,
  fragmentShader: arcFragmentShader
})


export default class Arc extends Object3D {
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
    super.afterUpdate()
  }
}
