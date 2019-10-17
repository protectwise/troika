import { Group3DFacade, Object3DFacade } from 'troika-3d'
import {
  BackSide,
  Color,
  CylinderBufferGeometry,
  Mesh,
  MeshBasicMaterial,
  Plane,
  PlaneBufferGeometry,
  SphereBufferGeometry,
  Vector3
} from 'three'
import { createDerivedMaterial } from 'troika-three-utils'

const tempColor = new Color()
const tempPlane = new Plane()

const hsv2rgb_glsl = `
// From https://github.com/hughsk/glsl-hsv2rgb
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
`

// From https://gist.github.com/xpansive/1241234
function hsv2rgb (a, b, c, d, e, f) {
  d = a * 6 % 1
  f = [c, -c * d * b + c, e = -c * b + c, e, c * d * b + e, c]
  return [f[d = a * 6 | 0], f[(4 + d) % 6], f[(2 + d) % 6]]
}

// Adapted from https://github.com/Qix-/color-convert
function rgb2hsv (r, g, b) {
  let rdif
  let gdif
  let bdif
  let h
  let s

  const v = Math.max(r, g, b)
  const diff = v - Math.min(r, g, b)
  const diffc = function (c) {
    return (v - c) / 6 / diff + 1 / 2
  }

  if (diff === 0) {
    h = 0
    s = 0
  } else {
    s = diff / v
    rdif = diffc(r)
    gdif = diffc(g)
    bdif = diffc(b)

    if (r === v) {
      h = bdif - gdif
    } else if (g === v) {
      h = (1 / 3) + rdif - bdif
    } else if (b === v) {
      h = (2 / 3) + gdif - rdif
    }

    if (h < 0) {
      h += 1
    } else if (h > 1) {
      h -= 1
    }
  }

  return [h, s, v]
}

const cylinderGeometry = new CylinderBufferGeometry(0.5, 0.5, 1, 45)
  .translate(0, 0.5, 0)
  .rotateX(Math.PI / 2)
  .rotateZ(Math.PI / 2) //orient uv

const cylinderMaterial = createDerivedMaterial(new MeshBasicMaterial({side: 2}), {
  uniforms: {
    maxValue: {value: 1}
  },

  vertexDefs: `
varying vec3 vPos;
`,

  vertexMainIntro: `
vPos = position;
`,

  fragmentDefs: `
uniform float maxValue;
varying vec3 vPos;
${hsv2rgb_glsl}
`,

  fragmentColorTransform: `
float angle = atan(vPos.y, vPos.x) / PI2;
float radius = length(vPos.xy) * 2.0;
float value = vPos.z * maxValue;
vec3 hsv = vec3(angle, radius, value);
vec3 rgb = hsv2rgb(hsv);
gl_FragColor.xyz = rgb;
`
})

/**
 * Cylinder representing `hue` + `saturation` on its top disc surface and `value`
 * with its height.
 */
class HsvCylinder extends Object3DFacade {
  constructor (parent) {
    super(parent, new Mesh(
      cylinderGeometry,
      cylinderMaterial.clone()
    ))
    this.maxValue = 1
  }

  afterUpdate () {
    this.threeObject.material.uniforms.maxValue.value = this.maxValue
    super.afterUpdate()
  }
}

/**
 * Backside-only full height cylinder serving to hold visual shape of full cylinder
 * height when the main cylinder is shorter:
 */
class HsvCylinderBg extends Object3DFacade {
  constructor (parent) {
    const material = cylinderMaterial.clone()
    material.transparent = true
    material.opacity = 0.5
    material.side = BackSide

    super(parent, new Mesh(
      cylinderGeometry,
      material
    ))
  }
}

class ValueStick extends Object3DFacade {
  constructor (parent) {
    const ballGeom = new SphereBufferGeometry(0.05, 16, 12)
      .translate(0, 0, 0.5)
    const stickGeom = new CylinderBufferGeometry(0.005, 0.005, 0.5, 6)
      .translate(0, 0.25, 0).rotateX(Math.PI / 2)

    const material = new MeshBasicMaterial()

    const mesh = new Mesh(ballGeom, material)
    mesh.add(new Mesh(stickGeom, new MeshBasicMaterial({color: 0xcccccc})))
    super(parent, mesh)
  }

  afterUpdate () {
    this.threeObject.material.color.set(this.color)
    super.afterUpdate()
  }
}

class ValuePlane extends Object3DFacade {
  constructor (parent) {
    const material = createDerivedMaterial(new MeshBasicMaterial({
      transparent: true,
      color: 0xffffff,
      polygonOffset: true,
      polygonOffsetFactor: 1
    }), {
      vertexDefs: 'varying vec2 vUV;',
      vertexMainIntro: 'vUV = uv;',
      fragmentDefs: 'varying vec2 vUV;',
      fragmentColorTransform: `
        float dist = min(min(vUV.x, 1.0 - vUV.x), min(vUV.y, 1.0 - vUV.y));
        gl_FragColor.w *= 1.0 - 0.5 * smoothstep(0.0, 0.1, dist);
      `
    })
    super(parent, new Mesh(
      new PlaneBufferGeometry(),
      material
    ))
  }

  afterUpdate () {
    this.threeObject.material.opacity = this.opacity
    super.afterUpdate()
  }
}

class ColorPickerFacade extends Group3DFacade {
  constructor (parent) {
    super(parent)

    this.cylinderHeight = 0.5
    this.cylinderDiameter = 0.75

    // Tilt down so user can see both relevant dimensions
    // TODO can/should we automatically update this to match camera position?
    this.rotateX = -Math.PI / 4

    // Handle click/drag on surface of cylinder:
    const onHueSaturationDrag = e => {
      const obj = e.currentTarget.threeObject
      const ray = e.ray
      tempPlane.normal.set(0, 0, -1)
      tempPlane.constant = 1 //top of cylinder
      tempPlane.applyMatrix4(obj.matrixWorld)
      const intersection = ray.intersectPlane(tempPlane, new Vector3())
      if (intersection) {
        obj.worldToLocal(intersection)
        const x = intersection.x * 2
        const y = (intersection.y) * 2
        let angle = Math.atan2(y, x) / Math.PI / 2 //0-1
        while (angle < 0) angle += 1
        let radius = Math.min(1, Math.sqrt(x * x + y * y))

        const hsv = this._getHSV()
        hsv[0] = angle
        hsv[1] = radius
        this._updateHSV(hsv, e.shiftKey)
      }
    }

    // Move hsv value up and down with scroll wheel:
    this.onWheel = e => {
      const hsv = this._getHSV()
      hsv[2] = Math.max(0, Math.min(1, hsv[2] + e.nativeEvent.deltaY / 100))
      this._updateHSV(hsv, false)
    }

    this.children = [
      this.cylinderDef = {
        key: 'disc',
        facade: HsvCylinder,
        onMouseDown: onHueSaturationDrag,
        onDragStart: onHueSaturationDrag,
        onDrag: onHueSaturationDrag
      },
      this.cylinderBgDef = {
        facade: HsvCylinderBg,
        renderOrder: 9
      },
      this.planeDef = {
        facade: ValuePlane,
        renderOrder: 10,
        opacity: 0.3,
        pointerStates: {
          hover: {opacity: 0.4}
        },
        transition: {opacity: true},
        onDragStart: e => {
          this._dragData = {
            plane: new Plane().setFromNormalAndCoplanarPoint(
              new Vector3(0, 1, 0).transformDirection(this.threeObject.matrixWorld),
              e.intersection.point
            )
          }
        },
        onDrag: e => {
          const {plane} = this._dragData
          const coplanarPoint = e.ray.intersectPlane(plane, new Vector3())
          this.threeObject.worldToLocal(coplanarPoint)
          const hsv = this._getHSV()
          hsv[2] = Math.max(0, Math.min(1,
            coplanarPoint.z / this.cylinderHeight
          ))
          this._updateHSV(hsv, e.shiftKey)
        },
        onDragEnd: e => {
          this._dragData = null
        }
      },
      this.stickDef = {
        facade: ValueStick
      }
    ]
  }

  _getHSV () {
    let hsv = [0, 0, 0]
    if (this.value != null) {
      tempColor.set(this.value)
      hsv = rgb2hsv(tempColor.r, tempColor.g, tempColor.b)
    }
    return hsv
  }

  _updateHSV (hsv, websafe) {
    const rgb = hsv2rgb(...hsv)
    tempColor.setRGB(...rgb)
    if (websafe) {
      tempColor.r = Math.round(tempColor.r * 5) / 5
      tempColor.g = Math.round(tempColor.g * 5) / 5
      tempColor.b = Math.round(tempColor.b * 5) / 5
    }
    this.onChange(tempColor.getHex())
  }

  afterUpdate () {
    const {stickDef, cylinderDef, cylinderBgDef, planeDef, cylinderHeight, cylinderDiameter} = this
    const hsv = this._getHSV()

    // find x/y on disc for hue + saturation:
    const angle = hsv[0] * Math.PI * 2
    const radius = hsv[1] / 2 * cylinderDiameter
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius

    stickDef.x = x
    stickDef.y = y
    stickDef.z = hsv[2] * cylinderHeight
    stickDef.color = this.value

    cylinderDef.maxValue = hsv[2]
    cylinderDef.scale = cylinderDiameter
    cylinderDef.scaleZ = hsv[2] * cylinderHeight + 0.00001 //never zero scale
    cylinderBgDef.scale = cylinderDiameter
    cylinderBgDef.scaleZ = cylinderHeight

    planeDef.z = hsv[2] * cylinderHeight

    super.afterUpdate()
  }
}

export default ColorPickerFacade
