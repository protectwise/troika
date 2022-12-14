import {
  SphereGeometry,
  Mesh,
  MeshPhongMaterial,
  Color,
  ShaderLib,
  Vector3
} from 'three'
import {
  Instanceable3DFacade,
  createDerivedMaterial
} from 'troika-3d'



// Common shared geometry
const geometry = new SphereGeometry(1)

// Common shared material, implementing a custom `radius` uniform to use in place of
// scaling the matrix, and declaring that and the diffuse color as instanceable uniforms.
let customShaderMaterial = createDerivedMaterial(new MeshPhongMaterial(), {
  uniforms: {
    radius: {value: 1}
  },
  vertexDefs: 'uniform float radius;',
  vertexTransform: 'position *= radius;'
})

// Single mesh shared between all instanceables
const protoObj = new Mesh(geometry, customShaderMaterial)

// Helper mesh for raycasting transformation
const raycastObj = new Mesh(geometry.clone(), customShaderMaterial)
const tempVec3 = new Vector3()


class InstanceableSphereNoMatrix extends Instanceable3DFacade {
  constructor(parent) {
    super(parent)
    this.instancedThreeObject = protoObj
  }

  afterUpdate() {
    let {color, radius} = this
    if (this.hovered) color = 0xffffff
    if (color !== this._color) {
      this.setInstanceUniform('diffuse', new Color(color))
      this._color = color
    }
    if (radius !== this._radius) {
      this.setInstanceUniform('radius', radius)
      this._radius = radius
      this.notifyWorld('object3DBoundsChanged') //let world know it needs to update the bounding sphere octree
    }
    super.afterUpdate()
  }

  getBoundingSphere() {
    let sphere = super.getBoundingSphere()
    if (sphere.radius !== this.radius) {
      sphere.radius = this.radius //scale by the radius uniform since the matrix won't include scale
    }
    return sphere
  }

  raycast(raycaster) {
    this.updateMatrices()
    raycastObj.matrixWorld.copy(this.threeObject.matrixWorld)
    raycastObj.matrixWorld.scale(tempVec3.setScalar(this.radius))
    return this._raycastObject(raycastObj, raycaster)
  }
}



export default InstanceableSphereNoMatrix

