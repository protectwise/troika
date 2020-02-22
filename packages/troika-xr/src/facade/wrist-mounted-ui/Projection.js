import { MeshFacade } from 'troika-3d'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
  Vector4
} from 'three'


const vertexShader = `
varying vec2 vUV;
void main() {
  vUV = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`

const baseAlpha = 0.2
const scanlines = [
  // sep = separation between lines
  // vel = movement speed, in scans per second
  // size = width of line's gradient
  // alpha = alpha to add at line's center
  {sep: 0.4, vel: 0.15, size: 0.1, alpha: 0.1},
  {sep: 0.7, vel: 0.2, size: 0.15, alpha: 0.1},
  {sep: 0.3, vel: 0.3, size: 0.1, alpha: 0.1},
  {sep: 0.2, vel: 0.6, size: 0.1, alpha: 0.04},
  {sep: 0.1, vel: 0.4, size: 0.02, alpha: 0.04},
]

const fragmentShader = `
uniform float time;
uniform vec4 fade;
uniform vec3 color;
varying vec2 vUV;

float distToScanline(float x, float separation, float velocity) {
  x += time / 1000.0 * velocity;
  float dist = abs(x - round(x / separation) * separation);
  return dist;
}

void main() {
  float alpha = ${baseAlpha};
  ${scanlines.map(({sep, vel, size, alpha}) =>
    `alpha += ${alpha} * smoothstep(${size / 2}, 0.0, distToScanline(vUV.y, ${sep}, ${vel}));`
  ).join('\n')}
  alpha *= min(smoothstep(fade.x, fade.y, vUV.y), smoothstep(fade.w, fade.z, vUV.y));
  gl_FragColor = vec4(color, alpha);
}
`

const epoch = Date.now()

let createMaterial = function() {
  return new ShaderMaterial({
    uniforms: {
      time: {get value() {return epoch - Date.now()}},
      color: {value: new Color(0x3399ff)},
      fade: {value: new Vector4(0, 0.4, 0.7, 1)} //fade in+out gradient stops
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    // side: DoubleSide
  })
}

// 0 = cone point; 1-4 = top face's 4 corners in clockwise order
const geomIndexes = [
  0, 1, 2,
  0, 2, 3,
  0, 3, 4,
  0, 4, 1
]
const uvs = new Float32Array([
  0, 0,
  0, 1,
  0, 1,
  0, 1,
  0, 1
])

export class Projection extends MeshFacade {
  constructor (parent) {
    super(parent)
    this.threeObject.frustumCulled = false
    this.renderOrder = 99999

    let geom = new BufferGeometry()
    geom.setAttribute('position', new BufferAttribute(new Float32Array(15), 3))
    geom.setAttribute('uv', new BufferAttribute(uvs, 2))
    geom.setIndex(geomIndexes)
    this.autoDisposeGeometry = true
    this.geometry = geom

    this.material = createMaterial()
  }

  afterUpdate() {
    // Update geometry vertices
    let { from, to1, to2, to3, to4 } = this
    let posAttr = this.geometry.getAttribute('position')
    posAttr.setXYZ(0, from.x, from.y, from.z)
    posAttr.setXYZ(1, to1.x, to1.y, to1.z)
    posAttr.setXYZ(2, to2.x, to2.y, to2.z)
    posAttr.setXYZ(3, to3.x, to3.y, to3.z)
    posAttr.setXYZ(4, to4.x, to4.y, to4.z)
    posAttr.needsUpdate = true
    super.afterUpdate()
  }
}
