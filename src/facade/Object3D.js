import forOwn from 'lodash/forOwn'
import {Vector3, Matrix4, Quaternion, Object3D as ThreeObject3D} from 'three'
import Parent from './Parent'

const MOUSE_EVENT_PROPS = ['onMouseOver', 'onMouseOut', 'onMouseDown', 'onMouseUp', 'onClick', 'onDoubleClick']

const lookAtRotationMatrix = new Matrix4()
const lookAtPos = new Vector3()
const lookAtUp = new Vector3(0, 1, 0)
const lookAtQuaternion = new Quaternion()

class Object3D extends Parent {
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
      if (parent instanceof Object3D) {
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
      lookAtUp.copy(this.up || ThreeObject3D.DefaultUp)
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

  getCameraPosition() {
    var _pos = null
    this.notifyWorld('getCameraPosition', pos => _pos = pos)
    return _pos
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
    MOUSE_EVENT_PROPS.forEach(type => {
      this[`${type}➤handler`] = null
    })
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
    Object.defineProperty(Object3D.prototype, propName, {
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


// Setup handlers for mouse event properties
MOUSE_EVENT_PROPS.forEach(eventName => {
  let privateProp = `${ eventName }➤handler`
  Object.defineProperty(Object3D.prototype, eventName, {
    get() {
      return this[privateProp]
    },
    set(handler) {
      if ((handler || null) !== (this[eventName] || null)) {
        this[privateProp] = handler

        // Add/remove from the global event registry
        this.notifyWorld(handler ? 'addEventListener' : 'removeEventListener', {
          type: eventName,
          handler: handler
        })
      }
    }
  })
})


export default Object3D
export {MOUSE_EVENT_PROPS}
