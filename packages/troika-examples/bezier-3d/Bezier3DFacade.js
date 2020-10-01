import { Object3DFacade, Instanceable3DFacade } from 'troika-3d'
import { BezierMesh } from 'troika-three-utils'
import { Color, DoubleSide, MeshStandardMaterial, Vector3 } from 'three'

const noDash = [0, 0]
const tempColor = new Color()
const defaultMaterial = new MeshStandardMaterial({transparent: true, side: DoubleSide})

/**
 * Facade wrapper around BezierMesh from three-troika-utils
 */
export class Bezier3DFacade extends Object3DFacade {
  constructor(parent) {
    super(parent, new BezierMesh())
    this.radius = 0.01
    this.opacity = 1
    this.color = 0xffffff
    this.dashArray = [0, 0]
    this.dashOffset = 0
    this.material = defaultMaterial.clone()
  }

  afterUpdate() {
    const {
      threeObject:obj,
      p1x, p1y, p1z,
      c1x, c1y, c1z,
      c2x, c2y, c2z,
      p2x, p2y, p2z,
      radius,
      dashArray,
      dashOffset,
      material,
      opacity,
      color
    } = this

    obj.pointA.set(p1x || 0, p1y || 0, p1z || 0)
    obj.controlA.set(c1x || 0, c1y || 0, c1z || 0)
    obj.controlB.set(c2x || 0, c2y || 0, c2z || 0)
    obj.pointB.set(p2x || 0, p2y || 0, p2z || 0)
    obj.radius = radius
    obj.dashArray.fromArray(dashArray || noDash)
    obj.dashOffset = dashOffset

    obj.material = material
    obj.material.opacity = opacity
    obj.material.transparent = opacity < 1
    obj.material.color.set(color)
    super.afterUpdate()
  }
}



const instancingMeshes = new WeakMap() //cache of singleton meshes for each material

/**
 * Instanceable version
 */
export class Bezier3DInstanceableFacade extends Instanceable3DFacade {
  constructor (parent) {
    super(parent)
    this.radius = 0.01
    this.opacity = 1
    this.color = this._color = new Color(0xffffff)
    this.dashArray = [0, 0]
    this.dashOffset = 0
    this.material = defaultMaterial
  }

  afterUpdate () {
    let {
      p1x, p1y, p1z,
      c1x, c1y, c1z,
      c2x, c2y, c2z,
      p2x, p2y, p2z,
      radius,
      dashArray,
      dashOffset,
      opacity,
      color
    } = this

    /*
    pointA: {value: new Vector3()},
    controlA: {value: new Vector3()},
    controlB: {value: new Vector3()},
    pointB: {value: new Vector3()},
    radius: {value: 0.01},
    dashing: {value: new Vector3()} //on, off, offset
    */
    if (p1x !== this._p1x || p1y !== this._p1y || p1z !== this._p1z) {
      this.setInstanceUniform('pointA', new Vector3(this._p1x = p1x, this._p1y = p1y, this._p1z = p1z))
    }
    if (c1x !== this._c1x || c1y !== this._c1y || c1z !== this._c1z) {
      this.setInstanceUniform('controlA', new Vector3(this._c1x = c1x, this._c1y = c1y, this._c1z = c1z))
    }
    if (c2x !== this._c2x || c2y !== this._c2y || c2z !== this._c2z) {
      this.setInstanceUniform('controlB', new Vector3(this._c2x = c2x, this._c2y = c2y, this._c2z = c2z))
    }
    if (p2x !== this._p2x || p2y !== this._p2y || p2z !== this._p2z) {
      this.setInstanceUniform('pointB', new Vector3(this._p2x = p2x, this._p2y = p2y, this._p2z = p2z))
    }
    if (radius !== this._radius) {
      this.setInstanceUniform('radius', this._radius = radius)
    }
    dashArray = dashArray || noDash
    let lastDashArray = this._dashArray || noDash
    if (dashArray[0] !== lastDashArray[0] || dashArray[1] !== lastDashArray[1] || dashOffset !== this._dashOffset) {
      this._dashArray = dashArray
      this.setInstanceUniform('dashing', new Vector3(dashArray[0], dashArray[1], this._dashOffset = dashOffset))
    }

    // Material color and opacity:
    if (!tempColor.set(color).equals(this._color)) {
      this.setInstanceUniform('diffuse', this._color = new Color(color))
    }
    if (opacity !== this._opacity) {
      this.setInstanceUniform('opacity', this._opacity = opacity)
    }

    super.afterUpdate()
  }

  set material(material) {
    if (material !== this._material) {
      this._material = material
      let mesh = instancingMeshes.get(material)
      if (!mesh) {
        mesh = new BezierMesh()
        mesh.castShadow = true //TODO - figure out how to control shadow casting
        mesh.material = material
        mesh.material.instanceUniforms = this.getInstanceUniforms()
        instancingMeshes.set(material, mesh)
      }
      this.instancedThreeObject = mesh
    }
  }

  getInstanceUniforms() {
    return [
      'pointA',
      'controlA',
      'controlB',
      'pointB',
      'radius',
      'dashing',

      // Set up instancing for material color and opacity by default; users can specify additional
      // material-specific uniforms by extending and overriding. TODO - find a nicer way
      'diffuse',
      'opacity'
    ]
  }
}
