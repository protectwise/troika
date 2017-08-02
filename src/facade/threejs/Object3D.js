import {assign, forOwn} from '../../utils'
import {Vector3, Matrix4, Quaternion, Object3D} from 'three'
import PointerEventTarget from '../PointerEventTarget'
import {defineEventProperty} from '../Facade'

const singletonVec3 = new Vector3()
const singletonMat4 = new Matrix4()
const singletonQuat = new Quaternion()
const lookAtUp = new Vector3(0, 1, 0)
const notifyWorldGetter = (function() {
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
    threeObject.matrixAutoUpdate = false

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
    if (this.lookAt) {
      singletonVec3.copy(this.lookAt)
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
        this.traverse((facade, rootFacade) => {
          if (facade !== rootFacade && facade.updateMatrices) {
            facade.updateMatrices()
          }
        }, this)
      }
      this._worldMatrixVersionAfterLastUpdate = this._worldMatrixVersion
    }

    // Process children
    super.afterUpdate()

    // If any children were removed during the update, remove them from the threejs
    // object in a single batch; this avoids threejs's very expensive single-item remove.
    if (this._removeChildIds) {
      let removeChildIds = this._removeChildIds
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
            this._parentObject3DFacade._queueRemoveChildObject3D(threeObject.id)
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
    this.notifyWorld('getCameraPosition', notifyWorldGetter)
    return notifyWorldGetter.value
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
   * Get the current projected user space position for this object, or for a specific position
   * in its object space.
   * @returns {Vector3} x and y are in screen pixels, z is worldspace distance from camera.
   */
  getProjectedPosition(x=0, y=0, z=0) {
    this.updateMatrices()
    notifyWorldGetter.worldPosition = singletonVec3.set(x, y, z).applyMatrix4(this.threeObject.matrixWorld)
    this.notifyWorld('projectWorldPosition', notifyWorldGetter)
    return notifyWorldGetter.value
  }

  /**
   * Determine if this facade's threeObject intersects a Raycaster. Override this method to provide
   * custom raycasting logic, for example when additional meshes need to be checked or a vertex shader
   * manipulates the geometry.
   *
   * The return value can be:
   *   - An array of hit objects for this facade, matching the format returned by `Raycaster.intersectObject`
   *   - `null`, if this facade has no hits
   *   - `false`, if this facade has no hits *and* descendant facades should not be queried. This can
   *     be implemented in overridden methods to optimize large scenes by ignoring entire groups when
   *     a parent can safely determine the extent of all its children.
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

  _queueRemoveChildObject3D(threeObjectId) {
    let removeChildIds = this._removeChildIds || (this._removeChildIds = Object.create(null))
    removeChildIds[threeObjectId] = true
  }

  destructor() {
    let parentObj3D = this._parentObject3DFacade
    if (parentObj3D) {
      parentObj3D._queueRemoveChildObject3D(this.threeObject.id)
    }
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
    // Compile functions to avoid runtime cost of aspect/attr evaluation
    Object.defineProperty(Object3DFacade.prototype, propName, {
      get: new Function(`return function ${propName}$get() {
  this.threeObject.${aspect}.${attr}
}`)(),
      set: new Function(`return function ${propName}$set(value) {
  //let obj = this.threeObject.${aspect}
  if (this.threeObject.${aspect}.${attr} !== value) {
    this.threeObject.${aspect}.${attr} = value
    if (!this._matrixChanged) {
      this._matrixChanged = true
    }
  }
}`)()
    })
  })

})


Object.defineProperty(Object3DFacade.prototype, 'isObject3DFacade', {value: true})

// Predefine shape to facilitate JS engine optimization
assign(Object3DFacade.prototype, {
  lookAt: null,
  threeObject: null,
  _parentObject3DFacade: null,
  _removeChildIds: null,
  _matrixChanged: false,
  _worldMatrixVersion: -1,
  _worldMatrixVersionAfterLastUpdate: -1
})

// Define onBeforeRender/onAfterRender event handler properties
defineEventProperty(Object3DFacade, 'onBeforeRender')
defineEventProperty(Object3DFacade, 'onAfterRender')


export default Object3DFacade
