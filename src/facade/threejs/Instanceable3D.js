import {Object3D} from 'three'
import Object3DFacade from './Object3D'

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
 * referenced mesh.
 */
class Instanceable3DFacade extends Object3DFacade {
  constructor(parent) {
    let obj = new Object3D()
    super(parent, obj)
    this.notifyWorld('addInstanceable', this)
  }

  set instancedThreeObject(obj) {
    if (obj !== this._instancedThreeObject) {
      this._instancedThreeObject = obj
      this.notifyWorld('instanceableChanged')
    }
  }
  get instancedThreeObject() {
    return this._instancedThreeObject
  }

  afterUpdate() {
    super.afterUpdate()
    if (this._worldMatrixVersion !== this._lastInstancedMatrixVersion) {
      this.notifyWorld('instanceableChanged')
      this._lastInstancedMatrixVersion = this._worldMatrixVersion
    }
  }

  destructor() {
    this.notifyWorld('removeInstanceable', this)
    super.destructor()
  }

  // Custom raycasting based on current geometry and transform
  raycast(raycaster) {
    let instancedObj = this.instancedThreeObject
    if (instancedObj) {
      let testerObject = Object.create(instancedObj)
      testerObject.matrixWorld = this.threeObject.matrixWorld
      return raycaster.intersectObject(testerObject, false)
    }
    return null
  }

}

// Prevent the threeObject from being added to the threejs scene graph, since it's
// only used for its transform matrices, so it doesn't need to be visited in WebGLRenderer's
// projectObject pass etc.
// TODO this gives a decent speed boost but also prevents any child objects from being
// rendered. Should either figure out a way to orphan/unorphan dynamically based on the
// presence of children, or just disallow children altogether.
// Object.defineProperty(Instanceable3DFacade.prototype, 'isOrphaned', {value: true})

export default Instanceable3DFacade
