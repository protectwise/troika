import { MeshFacade } from 'troika-3d'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  ShaderMaterial,
  Vector4
} from 'three'


const vertexShader = `
varying vec2 vUV;
void main() {
  vUV = uv;
  if (uv.y == 0.0) { //src pos is worldspace
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  } else {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
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

const defaultColor = 0x3399ff

let createMaterial = function() {
  return new ShaderMaterial({
    uniforms: {
      time: {get value() {return epoch - Date.now()}},
      color: {value: new Color()},
      fade: {value: new Vector4(0, 0.4, 0.7, 1)} //fade in+out gradient stops
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    // side: DoubleSide
  })
}

/**
 * A holographic projection cone effect. Creates a translucent mesh in a cone shape from
 * a single world-space source vertex to an arbitrary target shape, with animated lines
 * traveling from source to target.
 *
 * @member {Vector3} sourceWorldPosition - The world-space position of the cone's source
 * @member {number[]} targetVertices - The local-space vertices describing the target shape,
 *         e.g. a rectangle or circle. This array is treated as immutable, so if you need to
 *         update the vertices then pass a new array instance.
 * @member {Color|number|string} color - The color of the
 */
export class Projection extends MeshFacade {
  constructor (parent) {
    super(parent)
    this.threeObject.frustumCulled = false
    this.renderOrder = 99999

    this.geometry = new BufferGeometry()
    this.autoDisposeGeometry = true
    this.color = defaultColor

    this.material = createMaterial()
  }

  syncSourcePosition() {
    // Sync the geometry from the current sourceWorldPosition value
    let {sourceWorldPosition:srcPos} = this
    let posAttr = this.threeObject.geometry.getAttribute('position')
    if (srcPos && posAttr && (
      srcPos.x !== posAttr.getX(0) || srcPos.y !== posAttr.getY(0) || srcPos.z !== posAttr.getZ(0)
    )) {
      posAttr.setXYZ(0, srcPos.x, srcPos.y, srcPos.z)
      posAttr.needsUpdate = true
    }
  }

  afterUpdate() {
    let {targetVertices, geometry, color} = this

    // Update geometry vertices
    let posAttr = this.geometry.getAttribute('position')
    if (!posAttr || posAttr._data !== targetVertices) { //Note: targetVertices treated as immutable
      // position attribute: [...source_vertices, ...targetVertices]
      let posArr = new Float32Array(targetVertices.length + 3)
      posArr.set(targetVertices, 3) //first pos reserved for source vertex
      posAttr = new BufferAttribute(posArr, 3)
      posAttr.usage = DynamicDrawUsage
      geometry.setAttribute('position', posAttr)

      // uv attribute: [0, 0, 0, 1, 0, 1, 0, 1, etc.]
      let uvAttr = new BufferAttribute(new Float32Array(posAttr.count * 2), 2)
      for (let i = 1; i < uvAttr.count; i++) {
        uvAttr.setY(i, 1)
      }
      geometry.setAttribute('uv', uvAttr)

      // index: triangles from the source vertex to each consecutive pair of target vertices
      let indexArr = []
      for (let i = 1, len = targetVertices.length / 3; i <= len; i++) {
        indexArr.push(0, i === 1 ? len : i - 1, i)
      }
      geometry.setIndex(indexArr)
    }

    // Handle changing sourceWorldPosition
    this.syncSourcePosition()

    // Material
    if (color == null) {
      color = defaultColor
    }
    if (color !== this._color) {
      this.material.uniforms.color.value.set(this._color = color)
    }

    super.afterUpdate()
  }
}
