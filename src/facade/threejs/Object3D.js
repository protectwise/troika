import forOwn from 'lodash/forOwn'
import {Vector3, Matrix4, Quaternion, Object3D} from 'three'
import PointerEventTarget from '../PointerEventTarget'

const lookAtRotationMatrix = new Matrix4()
const lookAtPos = new Vector3()
const lookAtUp = new Vector3(0, 1, 0)
const lookAtQuaternion = new Quaternion()

class Object3DFacade extends PointerEventTarget {
  constructor(parent, threeObject) {
    super(parent)

    // We'll track matrix updates manually
    this._matrixChanged = false
    threeObject.matrixAutoUpdate = false

    // Set bidirectional refs
    this.threeObject = threeObject
    threeObject.$facade = this

    // Add it as a child of the nearest parent threeObject, if one exists
    while (parent) {
      if (parent instanceof Object3DFacade) {
        parent.threeObject.add(threeObject)
        break
      }
      parent = parent.parent
    }
  }

  afterUpdate() {
    let threeObject = this.threeObject

    // Apply lookAt+up as a final transform - applied as individual quaternion
    // properties so they can selectively trigger updates, be transitioned, etc.
    let lookAt = this.lookAt
    if (lookAt) {
      lookAtPos.copy(lookAt)
      lookAtUp.copy(this.up || Object3D.DefaultUp)
      lookAtRotationMatrix.lookAt(threeObject.position, lookAtPos, lookAtUp)
      lookAtQuaternion.setFromRotationMatrix(lookAtRotationMatrix)
      this.quaternionX = lookAtQuaternion.x
      this.quaternionY = lookAtQuaternion.y
      this.quaternionZ = lookAtQuaternion.z
      this.quaternionW = lookAtQuaternion.w
    }

    if (this._matrixChanged) {
      threeObject.updateMatrix()
      this._matrixChanged = false
    }
    super.afterUpdate()
  }

  /**
   * Get the current position vector of the world's camera.
   * @returns {Vector3}
   */
  getCameraPosition() {
    var _pos = null
    this.notifyWorld('getCameraPosition', pos => _pos = pos)
    return _pos
  }

  /**
   * Calculate the distance in world units between this object's origin and the camera.
   * @returns {Number}
   */
  getCameraDistance() {
    if (this._matrixChanged) {
      this.threeObject.updateMatrix()
      this._matrixChanged = false
    }
    let cameraPos = this.getCameraPosition()
    let objectPos = this.threeObject.getWorldPosition()
    return cameraPos.distanceTo(objectPos)
  }

  /**
   * Register a callback function to be called after the scene's state and all the underlying
   * threeObjects have been synced, but just before the WebGL is rendered. The callback will be
   * passed the arguments (webglRenderer, scene, camera). This is a good place to perform things
   * like rendering a portion of the scene into a texture to be used in the final render.
   * @param {Function} fn
   */
  addBeforeRenderCallback(fn) {
    this.notifyWorld('addBeforeRenderCallback', fn)
  }

  /**
   * Determine if this facade's threeObject intersects a Raycaster. Return format is the same
   * as that of `Raycaster.intersectObject`. Override this method to provide custom raycasting
   * logic, for example when additional meshes need to be checked or a vertex shader manipulates
   * the geometry.
   */
  raycast(raycaster) {
    let threeObject = this.threeObject
    return threeObject && raycaster.intersectObject(threeObject, false) || null
  }

  destructor() {
    let threeObject = this.threeObject
    if (threeObject.parent) {
      threeObject.parent.remove(threeObject)
    }
    delete threeObject.$facade
    delete this.threeObject
    super.destructor()
  }
}


// Create flat property setters for individual position/scale/rotation properties
forOwn({
  position: {
    x: 'x',
    y: 'y',
    z: 'z'
  },
  scale: {
    x: 'scaleX',
    y: 'scaleY',
    z: 'scaleZ'
  },
  rotation: {
    x: 'rotateX',
    y: 'rotateY',
    z: 'rotateZ',
    order: 'rotateOrder'
  },
  quaternion: {
    x: 'quaternionX',
    y: 'quaternionY',
    z: 'quaternionZ',
    w: 'quaternionW'
  }
}, (attrs, aspect) => {
  forOwn(attrs, (propName, attr) => {
    Object.defineProperty(Object3DFacade.prototype, propName, {
      get() {
        return this.threeObject[aspect][attr]
      },

      set(value) {
        let obj = this.threeObject[aspect]
        if (obj[attr] !== value) {
          obj[attr] = value
          this._matrixChanged = true
        }
      }
    })
  })
})


export default Object3DFacade
