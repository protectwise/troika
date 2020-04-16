import { BoxBufferGeometry, Color, Mesh, MeshBasicMaterial, Vector4 } from 'three'
import {Instanceable3DFacade, createDerivedMaterial} from 'troika-3d'

const tempVec4 = new Vector4()

function getMesh() {
  let material = createDerivedMaterial(
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
  material.instanceUniforms = ['rect', 'diffuse']
  const mesh = new Mesh(
    new BoxBufferGeometry().translate(0, 0, -0.5), //origin on front face for distance sorting
    material
  )
  return (getMesh = () => mesh)()
}


// TODO make instanceable or a single updated geometry to limit to a single draw call

class RangeRectFacade extends Instanceable3DFacade {
  constructor (parent) {
    super(parent)
    this.instancedThreeObject = getMesh()
    this._color = new Color()
    this._rect = new Vector4()
  }

  afterUpdate() {
    const {top, right, bottom, left, color} = this
    if (!this._color.equals(color)) {
      this.setInstanceUniform('diffuse', this._color = new Color(color))
    }

    if (!this._rect.equals(tempVec4.set(left, top, right, bottom))) {
      this.setInstanceUniform('rect', tempVec4.clone())
    }
    super.afterUpdate()
  }

  getBoundingSphere () {
    return null
  }
}

export default RangeRectFacade
