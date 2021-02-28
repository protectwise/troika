import { BoxBufferGeometry, Color, Mesh, MeshBasicMaterial, Vector2, Vector4 } from 'three'
import {Instanceable3DFacade, createDerivedMaterial} from 'troika-3d'

const tempVec4 = new Vector4()

function getMeshes() {
  let material = createDerivedMaterial(
    new MeshBasicMaterial({
      transparent: true,
      opacity: 0.3,
      depthWrite: false
    }),
    {
      uniforms: {
        rect: {value: new Vector4()},
        depthAndCurveRadius: {value: new Vector2()}
      },
      vertexDefs: `
uniform vec4 rect;
uniform vec2 depthAndCurveRadius;
`,
      vertexTransform: `
float depth = depthAndCurveRadius.x;
float rad = depthAndCurveRadius.y;
position.x = mix(rect.x, rect.z, position.x);
position.y = mix(rect.w, rect.y, position.y);
position.z = mix(-depth * 0.5, depth * 0.5, position.z);
if (rad != 0.0) {
  float angle = position.x / rad;
  position.xz = vec2(sin(angle) * (rad - position.z), rad - cos(angle) * (rad - position.z));
  // TODO fix normals: normal.xz = vec2(sin(angle), cos(angle));
}
`
    }
  )
  const meshes = {
    normal: new Mesh(
      new BoxBufferGeometry(1, 1, 1).translate(0.5, 0.5, 0.5),
      material
    ),
    curved: new Mesh(
      new BoxBufferGeometry(1, 1, 1, 32).translate(0.5, 0.5, 0.5),
      material
    )
  }
  return (getMeshes = () => meshes)()
}


// TODO make instanceable or a single updated geometry to limit to a single draw call

class RangeRectFacade extends Instanceable3DFacade {
  constructor (parent) {
    super(parent)
    this.depth = 0
    this.curveRadius = 0
    this._color = new Color()
    this._rect = new Vector4()
  }

  afterUpdate() {
    const {top, right, bottom, left, color, depth, curveRadius} = this
    this.instancedThreeObject = getMeshes()[curveRadius ? 'curved' : 'normal']

    if (!this._color.equals(color)) {
      this.setInstanceUniform('diffuse', this._color = new Color(color))
    }

    if (!this._rect.equals(tempVec4.set(left, top, right, bottom))) {
      this.setInstanceUniform('rect', tempVec4.clone())
    }
    if (!depth !== this._depth || curveRadius !== this._curveRadius) {
      this.setInstanceUniform('depthAndCurveRadius', new Vector2(this._depth = depth, this._curveRadius = curveRadius))
    }
    super.afterUpdate()
  }

  getBoundingSphere () {
    return null
  }
}

export default RangeRectFacade
