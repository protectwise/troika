import { BoxBufferGeometry, Mesh, MeshBasicMaterial, Vector4 } from 'three'
import {Object3DFacade, createDerivedMaterial} from 'troika-3d'

function getRectGeometry() {
  const geom = new BoxBufferGeometry().translate(0, 0, -0.5) //origin on front face for distance sorting
  getRectGeometry = () => geom
  return geom
}
function getRectMaterial() {
  const mtl = createDerivedMaterial(
    new MeshBasicMaterial({
      transparent: true,
      opacity: 0.3,
      depthWrite: false
    }),
    {
      uniforms: {
        rect: {value: new Vector4()}
      },
      vertexDefs: `uniform vec4 rect;`,
      vertexTransform: `
  position.x = position.x < 0.0 ? rect.x : rect.z;
  position.y = position.y < 0.0 ? rect.w : rect.y;
  `
    }
  )
  getRectMaterial = () => mtl
  return mtl
}


// TODO make instanceable or a single updated geometry to limit to a single draw call

class RangeRectFacade extends Object3DFacade {
  constructor(parent) {
    super(parent, new Mesh(
      getRectGeometry(),
      getRectMaterial().clone()
    ))
  }
  afterUpdate() {
    const {top, right, bottom, left, color} = this
    if (color !== this._color) {
      this.threeObject.material.color.set(this._color = color)
    }
    this.threeObject.material.uniforms.rect.value.set(left, top, right, bottom)
    super.afterUpdate()
  }
}

export default RangeRectFacade
