import { utils } from 'troika-core'
import { Object3D } from 'three'
import Object3DFacade from '../Object3DFacade.js'

/**
 * Instanceable3DFacade is a specialized Object3DFacade that renders using GPU
 * instancing. This can give a significant performance boost for objects that
 * are rendered many thousands of times in a scene.
 *
 * Usage is nearly identical to an Object3DFacade, but instead of creating a
 * `threeObject` in the constructor, you set its `instancedThreeObject` property
 * to a common shared Mesh object. Any other Instanceable3DFacades in the scene
 * that reference the same `instancedThreeObject` will be batched together and
 * rendered using a single GPU draw call. The `instancedThreeObject` can be
 * changed at any time, allowing dynamic appearance changes by swapping out the
 * referenced mesh or its geometry or material.
 *
 * == Per-instance values: ==
 *
 * By default, the instances will each be rendered using their own world matrix
 * transform, so they can be positioned/scaled/rotated independently as usual.
 *
 * It is also possible, with a little extra effort, to allow specific shader
 * uniforms such as colors to be varied per instance. This works with both custom
 * shader materials as well as the built-in materials.
 *
 * To enable per-instance uniforms, use the `setInstanceUniform(name, value)`
 * method to set an instance's values for the enabled uniforms:
 *
 *     `this.setInstanceUniform('diffuse', new Color(color))`
 *
 * If an instance does not have a uniform value set this way, it will fall back to using
 * the default value in the material's `uniforms` object.
 *
 * The uniform types that allow instancing are: `int`, `float`, `vec2`, `vec3`, and `vec4`.
 * Mapping from application value types such as `Vector2` or `Color` behaves similarly to
 * how three.js does it internally. More complex uniform types such as textures are not
 * instanceable.
 *
 * == Caveats: ==
 *
 * It is generally not recommended to use this technique on meshes that are semi-
 * transparent, as there is no guarantee that they will be drawn in back-to-front
 * order relative to the camera position.
 */
class Instanceable3DFacade extends Object3DFacade {
  constructor(parent) {
    let obj = new Object3D()

    // Trigger scene graph size optimizations
    obj.isRenderable = false

    // Visibility change affects batching so listen for changes
    obj.$troikaVisible = obj.visible
    Object.defineProperty(obj, 'visible', visibilityPropDef)

    super(parent, obj)

    this.notifyWorld('instanceableAdded')
  }

  /**
   * @property {Object3D} instancedThreeObject
   * Sets the Mesh instance to use for batching this instance with others that
   * reference the same Mesh.
   */

  /**
   * Sets this instance's value for a shader uniform.
   * @param {String} name
   * @param {Number|Vector2|Vector3|Vector4|Color} value
   */
  setInstanceUniform(name, value) {
    let values = this._instanceUniforms || (this._instanceUniforms = Object.create(null))
    if (values[name] !== value) {
      // If this is a new uniform value, add it to the Set of instance uniform names
      const obj = this.instancedThreeObject
      if (obj && !(name in values)) {
        const names = obj._instanceUniformNames || (obj._instanceUniformNames = new Set())
        names.add(name)
      }
      values[name] = value
      this.notifyWorld('instanceableUniformChanged', name)
    }
  }

  afterUpdate() {
    const newObj = this.instancedThreeObject
    const oldObj = this._instancedObj
    if (newObj !== oldObj) {
      if (newObj && this._instanceUniforms) { //make sure new object tracks our instance uniforms
        const names = newObj._instanceUniformNames || (newObj._instanceUniformNames = new Set())
        for (let name in this._instanceUniforms) {
          names.add(name)
        }
      }
      this._instancedObj = newObj
      this.notifyWorld('instanceableChanged')
      this._boundsChanged = true
    }
    super.afterUpdate()
  }

  updateMatrices() {
    const prevMatrixVersion = this._worldMatrixVersion

    super.updateMatrices()

    // If the world matrix changed, we must notify the instancing manager
    if (this._worldMatrixVersion !== prevMatrixVersion && this.threeObject.$troikaVisible) {
      this.notifyWorld('instanceableMatrixChanged')
    }
  }

  destructor() {
    this.notifyWorld('instanceableRemoved')
    super.destructor()
  }

  // Custom bounding sphere calc
  getGeometry() {
    let instancedObj = this.instancedThreeObject
    return instancedObj && instancedObj.geometry
  }

  // Custom raycasting based on current geometry and transform
  raycast(raycaster) {
    let {instancedThreeObject, threeObject} = this
    if (instancedThreeObject && threeObject) {
      let origMatrix = instancedThreeObject.matrixWorld
      instancedThreeObject.matrixWorld = threeObject.matrixWorld
      let result = this._raycastObject(instancedThreeObject, raycaster) //use optimized method
      instancedThreeObject.matrixWorld = origMatrix
      return result
    }
    return null
  }
}

const visibilityPropDef = {
  set(visible) {
    if (visible !== this.$troikaVisible) {
      this.$troikaVisible = visible
      this.$facade.notifyWorld('instanceableChanged')
    }
  },
  get() {
    return this.$troikaVisible
  }
}

// Predefine shape to facilitate JS engine optimization
utils.assign(Instanceable3DFacade.prototype, {
  _lastInstancedMatrixVersion: -1,
  _instancedThreeObject: null
})


export default Instanceable3DFacade
