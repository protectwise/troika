import { createDerivedMaterial } from 'troika-three-utils'
import {
  BoxBufferGeometry,
  PlaneBufferGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector4,
  DoubleSide,
  FrontSide
} from 'three'
import { Object3DFacade } from 'troika-3d'

/*

Geometry:
- Base is a 1x1 plane (or cube?) with N width segments and 2 height segments
- Instance attr: bezier control points

Shader:
- Calculate point and normal on bezier for x
- Adjust normal for non-uniform scale (?)
- For top 2 vertices, translate outward along the bezier's normal
- Bottom vertex is same x as mid vertex but y=0

 */

const vertexDefs = `
uniform float thickness;
uniform float curviness;
attribute vec4 segment; //p1, p2
varying vec3 vPosition;

vec2 cubicBezier(vec2 p1, vec2 c1, vec2 c2, vec2 p2, float t) {
  float t2 = 1.0 - t;
  float b0 = t2 * t2 * t2;
  float b1 = 3.0 * t * t2 * t2;
  float b2 = 3.0 * t * t * t2;
  float b3 = t * t * t;
  return b0 * p1 + b1 * c1 + b2 * c2 + b3 * p2;
}

vec2 cubicBezierDerivative(vec2 p1, vec2 c1, vec2 c2, vec2 p2, float t) {
  float t2 = 1.0 - t;
  return -3.0 * p1 * t2 * t2 +
    c1 * (3.0 * t2 * t2 - 6.0 * t2 * t) +
    c2 * (6.0 * t2 * t - 3.0 * t * t) +
    3.0 * p2 * t * t;
}
`

const vertexTransform = `
vec2 p1 = segment.xy;
vec2 p2 = segment.zw;
vec2 c1 = vec2(p1.x + (p2.x - p1.x) * curviness, p1.y);
vec2 c2 = vec2(p2.x - (p2.x - p1.x) * curviness, p2.y);
vec2 bzPoint = cubicBezier(p1, c1, c2, p2, position.x);
vec2 bzDeriv = cubicBezierDerivative(p1, c1, c2, p2, position.x);
vec2 bzNormal = normalize(vec2(-bzDeriv.y, bzDeriv.x));

// Area fill:
if (thickness == -1.0) {
  if (position.y == 0.0) {
    bzPoint.y = 0.0;
  } else {
    normal.xy = bzNormal;
  }
} 
// Flat ribbon:
else if (thickness == 0.0) {
  normal.xy = bzNormal;
}
// Thick ribbon:
else {
  bzPoint += bzNormal * thickness / 2.0 * sign(position.y - 0.5);
  if (normal.y != 0.0) {
    normal.xy = bzNormal * sign(position.y - 0.5);
  }
}
position.xy = bzPoint;
// float pinch = max(
//   smoothstep(edgeFade.y, edgeFade.x, position.x),
//   smoothstep(edgeFade.z, edgeFade.w, position.x)
// );
// if (pinch > 0.0) {
//   position.z = mix(position.z, -0.5, pinch);
// }
vPosition = position;
`

const fragmentDefs = `
uniform vec4 edgeFade;
varying vec3 vPosition;
`

const fragmentColorTransform = `
gl_FragColor.a *= min(
  smoothstep(edgeFade.x, edgeFade.y, vPosition.x),
  smoothstep(edgeFade.w, edgeFade.z, vPosition.x)
);
`

export function createLineGraphDerivedMaterial (baseMaterial) {
  return createDerivedMaterial(baseMaterial, {
    uniforms: {
      thickness: { value: 0 },
      curviness: { value: 0.5 },
      edgeFade: { value: new Vector4() }
    },
    vertexDefs,
    vertexTransform,
    fragmentDefs,
    fragmentColorTransform
  })
}

const templateGeometries = (() => {
  // The beziers will always be curvier toward the outside and flatter in the middle, so
  // shift the segments outward for better granularity on the curvier parts:
  function adjustPoints(geom) {
    geom.attributes.position.array.forEach((n, i, arr) => {
      if (i % 3 === 0) {
        arr[i] = 0.5 + Math.pow(Math.abs(n - 0.5) * 2, 0.5) / 2.0 * Math.sign(n - 0.5)
      }
    })
    return geom
  }
  return {
    threeD: adjustPoints(new BoxBufferGeometry(1, 1, 1, 16, 1, 1).translate(0.5, 0.5, -0.5)),
    twoDTall: adjustPoints(new PlaneBufferGeometry(1, 1, 16, 1).translate(0.5, 0.5, 0)),
    twoDDeep: adjustPoints(new PlaneBufferGeometry(1, 1, 16, 1).rotateX(-Math.PI / 2).translate(0.5, 0, -0.5))
  }
})()

export class LineSeries extends Object3DFacade {
  /**
   * @type {{x: number, y: number}}
   * Treated as immutable
   */
  points = []

  thickness = 0.01
  depth = 0.05
  color = 0xff00ff
  curviness = 0.5
  edgeFade = null //Vector4
  material = new MeshStandardMaterial({transparent: true})

  initThreeObject () {
    const mesh = new Mesh(new InstancedBufferGeometry())
    mesh.frustumCulled = false
    return mesh
  }

  afterUpdate () {
    const { points, threeObject, depth, thickness } = this
    let { material } = this

    const { geometry } = threeObject
    const geomStyle = depth === 0 ? 'twoDTall' : thickness === 0 ? 'twoDDeep' : 'threeD'
    if (geomStyle !== this._lastGeomStyle) {
      geometry.dispose()
      geometry.copy(templateGeometries[this._lastGeomStyle = geomStyle])
    }

    if (material !== threeObject.material.baseMaterial) {
      threeObject.material = createLineGraphDerivedMaterial(material)
      threeObject.customDepthMaterial = threeObject.material.getDepthMaterial()
    }
    material = threeObject.material
    material.side = geomStyle === 'twoDDeep' ? DoubleSide : FrontSide
    material.uniforms.thickness.value = thickness
    material.uniforms.curviness.value = Math.max(this.curviness, 1e-6) //pure straight lines would require mitering
    material.color.set(this.color)
    this.scaleZ = depth || 1 //prevent zero scale

    if (points !== this._points) {
      const segmentCount = Math.max(0, points.length - 1)
      let segmentAttr = geometry.getAttribute('segment')
      if (!segmentAttr || segmentAttr.count !== segmentCount) {
        segmentAttr = new InstancedBufferAttribute(new Float32Array(segmentCount * 4), 4)
        geometry.setAttribute('segment', segmentAttr)
      }
      if (segmentCount > 0) {
        for (let i = 0; i < points.length - 1; i++) {
          segmentAttr.setXYZW(i, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y)
        }
      }
      segmentAttr.needsUpdate = true
      if (segmentCount !== geometry.instanceCount) {
        geometry.instanceCount = segmentCount
        geometry.dispose()
      }

      let {edgeFade} = this
      if (!edgeFade) {
        const minX = points[0].x
        const maxX = points[points.length - 1].x
        edgeFade = new Vector4(
          minX,
          minX + (maxX - minX) * this.edgeFade,
          maxX - (maxX - minX) * this.edgeFade,
          maxX
        )
      }
      material.uniforms.edgeFade.value = edgeFade

      this._points = points
    }

    super.afterUpdate()
  }

  // TODO raycasting...
  //   Strategy: overall bbox check; use the x intersection to find candidate segment(s);
  //   iterate beziers for just those segments

  destructor() {
    this.threeObject.geometry.dispose()
    super.destructor()
  }
}
