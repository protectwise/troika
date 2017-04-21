import {forOwn} from '../../utils'
import {Vector3, Matrix4, Quaternion, Object3D} from 'three'
import PointerEventTarget from '../PointerEventTarget'
import {defineEventProperty} from '../Facade'

const singletonVec3 = new Vector3()
const singletonMat4 = new Matrix4()
const singletonQuat = new Quaternion()
const lookAtUp = new Vector3(0, 1, 0)
const cameraPosGetter = (function() {
  const obj = {
    callback: function(pos) {
      obj.value = pos
    },
    value: null
  }
  return obj
})()
const removedEvent = {type: 'removed'}
const singletonIntersects = []

function ascDistanceSort(a, b) {
  return a.distance - b.distance
}

function canObjectBeOrphaned(obj) {
  return obj.isRenderable === false && (
    !obj.children.length || obj.children.every(canObjectBeOrphaned)
  )
}

let _worldMatrixVersion = 0

class Object3DFacade extends PointerEventTarget {
  constructor(parent, threeObject) {
    super(parent)

    // We'll track matrix updates manually
    this._matrixChanged = false
    threeObject.matrixAutoUpdate = false
    this._worldMatrixVersion = this._worldMatrixVersionAfterLastUpdate = -1

    // Set bidirectional refs
    this.threeObject = threeObject
    threeObject.$facade = this

    // Subclasses may set isRenderable=false on the threeObject, to trigger some scene graph optimizations.
    // The first is to remove it from all layer masks to short-circuit WebGLRenderer.projectObject.
    let isRenderable = threeObject.isRenderable !== false
    if (!isRenderable) {
      threeObject.layers.mask = 0
    }

    // Add it as a child of the nearest parent threeObject, if one exists
    while (parent) {
      if (parent.isObject3DFacade) {
        this._parentObject3DFacade = parent //reference to nearest Object3DFacade ancestor
        if (isRenderable) { // Don't add to scene graph by default; might be added later if it has renderable children.
          parent.threeObject.add(threeObject)
        }
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
      singletonVec3.copy(lookAt)
      lookAtUp.copy(this.up || Object3D.DefaultUp)
      singletonMat4.lookAt(threeObject.position, singletonVec3, lookAtUp)
      singletonQuat.setFromRotationMatrix(singletonMat4)
      this.quaternionX = singletonQuat.x
      this.quaternionY = singletonQuat.y
      this.quaternionZ = singletonQuat.z
      this.quaternionW = singletonQuat.w
    }

    // Update matrix and worldMatrix before processing children
    this.updateMatrices()

    // If the world matrix was modified, and we won't be doing an update pass on child facades due
    // to `shouldUpdateChildren` optimization, we need to manually update their matrices to match.
    if (this._worldMatrixVersion > this._worldMatrixVersionAfterLastUpdate) {
      if (!this.shouldUpdateChildren()) {
        this.traverse(facade => {
          if (facade !== this && facade.updateMatrices) {
            facade.updateMatrices()
          }
        })
      }
      this._worldMatrixVersionAfterLastUpdate = this._worldMatrixVersion
    }

    // Process children
    super.afterUpdate()

    // If any children were removed during the update, remove them from the threejs
    // object in a single batch; this avoids threejs's very expensive single-item remove.
    let removeChildIds = this._removeChildIds
    if (removeChildIds) {
      threeObject.children = threeObject.children.filter(child => {
        if (child.id in removeChildIds) {
          child.parent = null
          child.dispatchEvent(removedEvent)
          return false
        }
        return true
      })
      this._removeChildIds = null
    }

    // Optimization for when the threeObject has been marked as non-renderable: keep it orphaned
    // from the scene graph unless it has renderable children of its own. This avoids having to visit
    // these objects in large loops (e.g. WebGLRenderer.projectObject) that will ignore them anyway.
    if (threeObject.isRenderable === false) {
      let parentThreeObject = this._parentObject3DFacade
      parentThreeObject = parentThreeObject && parentThreeObject.threeObject
      if (parentThreeObject) {
        if (threeObject.parent === parentThreeObject) {
          if (canObjectBeOrphaned(threeObject)) {
            this.notifyWorld('removeChildObject3D', threeObject)
          }
        }
        else if (!canObjectBeOrphaned(threeObject)) {
          parentThreeObject.add(threeObject)
        }
      }
    }
  }

  /**
   * Update the underlying threeObject's `matrix` and `matrixWorld` to the current state if necessary.
   * This bypasses the `updateMatrix` and `updateMatrixWorld` methods of the threejs objects with a more
   * efficient approach that doesn't require traversing the entire tree prior to every render. This is possible
   * since we control the update lifecycle; as long as this is called from the `afterUpdate` lifecycle
   * method or later, it can be safely assumed that the world matrices of all ancestors have already been
   * similarly updated so the result should always be accurate.
   * @returns {Boolean} true if an update was performed
   */
  updateMatrices() {
    let threeObj = this.threeObject
    let parent3DFacade = this._parentObject3DFacade
    let needsWorldMatrixUpdate
    if (this._matrixChanged) {
      threeObj.updateMatrix()
      this._matrixChanged = false
      needsWorldMatrixUpdate = true
    } else {
      needsWorldMatrixUpdate = parent3DFacade && parent3DFacade._worldMatrixVersion > this._worldMatrixVersion
    }
    if (needsWorldMatrixUpdate) {
      if (parent3DFacade) {
        threeObj.matrixWorld.multiplyMatrices(parent3DFacade.threeObject.matrixWorld, threeObj.matrix)
      } else {
        threeObj.matrixWorld.copy(threeObj.matrix)
      }

      // If the threeObject has children that were manually added (not managed by facades), we'll need to update them too
      // TODO can we determine this state without a full loop that will likely return nothing?
      let threeKids = threeObj.children
      for (let i = 0, len = threeKids.length; i < len; i++) {
        if (!threeKids[i].$facade) {
          threeKids[i].updateMatrixWorld(true)
        }
      }

      this._worldMatrixVersion = ++_worldMatrixVersion
    }
  }

  /**
   * Get this object's current position in world space
   * @param {Vector3} vec3 - optional Vector3 object to populate with the position;
   *                  if not passed in a new one will be created.
   * @returns {Vector3}
   */
  getWorldPosition(vec3 = new Vector3()) {
    this.updateMatrices()
    vec3.setFromMatrixPosition(this.threeObject.matrixWorld)
    return vec3
  }

  /**
   * Get the current position vector of the world's camera.
   * @returns {Vector3}
   */
  getCameraPosition() {
    this.notifyWorld('getCameraPosition', cameraPosGetter.callback)
    return cameraPosGetter.value
  }

  /**
   * Calculate the distance in world units between this object's origin and the camera.
   * @returns {Number}
   */
  getCameraDistance() {
    let cameraPos = this.getCameraPosition()
    let objectPos = this.getWorldPosition(singletonVec3)
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
    return this._raycastObject(this.threeObject, raycaster)
  }

  /**
   * Custom optimized raycast that, unlike Raycaster.intersectObject(), avoids creating a
   * new array unless there are actually hits.
   * @protected
   */
  _raycastObject(obj, raycaster) {
    if (obj.visible) {
      singletonIntersects.length = 0
      obj.raycast(raycaster, singletonIntersects)
      if (singletonIntersects.length) {
        singletonIntersects.sort(ascDistanceSort)
        return singletonIntersects.slice()
      }
    }
    return null
  }

  onNotifyWorld(source, message, data) {
    if (message === 'removeChildObject3D' && data) {
      let removeChildIds = this._removeChildIds || (this._removeChildIds = Object.create(null))
      removeChildIds[data.id] = true
    } else {
      super.onNotifyWorld(source, message, data)
    }
  }

  destructor() {
    this.notifyWorld('removeChildObject3D', this.threeObject)
    delete this.threeObject.$facade
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


Object.defineProperty(Object3DFacade.prototype, 'isObject3DFacade', {value: true})

// Define onBeforeRender/onAfterRender event handler properties
defineEventProperty(Object3DFacade, 'onBeforeRender')
defineEventProperty(Object3DFacade, 'onAfterRender')


export default Object3DFacade
