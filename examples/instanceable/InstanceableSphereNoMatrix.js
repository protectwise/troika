import {
  SphereBufferGeometry,
  Mesh,
  MeshPhongMaterial,
  Color,
  ShaderLib
} from 'three'
import {
  Instanceable3DFacade
} from '../../src/index'



// Common shared geometry
const geometry = new SphereBufferGeometry(1)

// Common shared material, implementing a custom `radius` uniform to use in place of
// scaling the matrix, and declaring that and the diffuse color as instanceable uniforms.
let customShaderMaterial = new MeshPhongMaterial()
customShaderMaterial.type = 'CustomPhongWithRadius'
customShaderMaterial.vertexShader = `
uniform float radius;
${ShaderLib.phong.vertexShader.replace('#include <begin_vertex>', `
$&
transformed *= radius;`
)}
`
customShaderMaterial.fragmentShader = ShaderLib.phong.fragmentShader
customShaderMaterial.uniforms = Object.assign({
  radius: {value: 1}
}, ShaderLib.phong.uniforms)
customShaderMaterial.instanceUniforms = ['radius', 'diffuse']

// Single mesh shared between all instanceables
const protoObj = new Mesh(geometry, customShaderMaterial)



class InstanceableSphereNoMatrix extends Instanceable3DFacade {
  constructor(parent) {
    super(parent)
    this.instancedThreeObject = protoObj
  }

  set color(color) {
    if (color !== this._color) {
      this.setInstanceUniform('diffuse', new Color(color))
      this._color = color
    }
  }
  get color() {
    return this._color
  }

  set radius(r) {
    if (r !== this._radius) {
      this.setInstanceUniform('radius', r)
      this._radius = r
    }
  }
  get radius() {return this._radius}
}



export default InstanceableSphereNoMatrix

