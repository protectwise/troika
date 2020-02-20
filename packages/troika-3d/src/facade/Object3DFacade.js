import { PointerEventTarget, Facade, utils } from 'troika-core'
import { Vector3, Sphere } from 'three'

const {assign, forOwn} = utils
const singletonVec3 = new Vector3()
const singletonVec3b = new Vector3()
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
let _geometrySphereVersion = 0

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
        if (isRenderable) {
          this._addToThreeObjectTree()
        }
        break
      }
      parent = parent.parent
    }

    this.notifyWorld('object3DAdded')
  }

  afterUpdate() {
    // Update matrix and worldMatrix before processing children
    this.updateMatrices()
    this._checkBoundsChange()

    // If the world matrix was modified, and we won't be doing an update pass on child facades due
    // to `shouldUpdateChildren` optimization, we need to manually update their matrices to match.
    if (this._worldMatrixVersion > this._worldMatrixVersionAfterLastUpdate) {
      if (!this.shouldUpdateChildren()) {
        this.traverse((facade, rootFacade) => {
          if (facade !== rootFacade && facade.updateMatrices) {
            facade.updateMatrices()
            facade._checkBoundsChange()
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
      let threeObject = this.threeObject
      let removeChildIds = this._removeChildIds
      threeObject.children = threeObject.children.filter(child => {
        if (child.id in removeChildIds) {
          child.parent = null
          child.dispatchEvent(removedEvent)
          return false
        }
        return true
      })

      // If that resulted in a non-renderable object having no renderable children,
      // queue it for removal it from the threejs object tree
      let parentObj3D = this._parentObject3DFacade
      if (canObjectBeOrphaned(threeObject) && parentObj3D && parentObj3D.threeObject === threeObject.parent) {
        parentObj3D._queueRemoveChildObject3D(threeObject.id)
      }

      this._removeChildIds = null
    }
  }

  /**
   * Update the underlying threeObject's `matrix` and `matrixWorld` to the current state if necessary.
   * This bypasses the `updateMatrix` and `updateMatrixWorld` methods of the threejs objects with a more
   * efficient approach that doesn't require traversing the entire tree prior to every render. This is possible
   * since we control the update lifecycle; as long as this is called from the `afterUpdate` lifecycle
   * method or later, it can be safely assumed that the world matrices of all ancestors have already been
   * similarly updated so the result should always be accurate.
   */
  updateMatrices() {
    let threeObj = this.threeObject
    let parent3DFacade = this._parentObject3DFacade
    let needsWorldMatrixUpdate
    if (this._matrixChanged) {
      threeObj.matrix.compose(threeObj.position, threeObj.quaternion, threeObj.scale)
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

      this.markWorldMatrixDirty()
    }
  }

  /**
   * If the `threeObject.matrixWorld` is modified manually instead of via the individual transformation
   * properties, you can call this to tell the facade its caches need to be recalculated.
   */
  markWorldMatrixDirty() {
    this._worldMatrixVersion = ++_worldMatrixVersion
    this._boundsChanged = true
  }

  _checkBoundsChange() {
    let changed = this._boundsChanged
    if (!changed) {
      const geomSphere = this._getGeometryBoundingSphere()
      if (geomSphere && geomSphere.version !== this._lastGeometrySphereVersion) {
        changed = true
        this._lastGeometrySphereVersion = geomSphere.version
      }
    }
    if (changed) {
      this.notifyWorld('object3DBoundsChanged')
      this._boundsChanged = false
    }
  }

  /**
   * Get this object's current position in world space
   * @param {Vector3} [vec3] - optional Vector3 object to populate with the position;
   *                  if not passed in a new one will be created.
   * @returns {Vector3}
   */
  getWorldPosition(vec3 ) {
    this.updateMatrices()
    return (vec3 || new Vector3()).setFromMatrixPosition(this.threeObject.matrixWorld)
  }

  /**
   * Get the current position vector of the world's camera.
   * @param {Vector3} [vec3] - optional Vector3 object to populate with the position;
   *                  if not passed in a new one will be created.
   * @returns {Vector3}
   */
  getCameraPosition(vec3 ) {
    vec3 = vec3 || new Vector3()
    this.notifyWorld('getCameraPosition', vec3)
    return vec3
  }

  /**
   * Get the facade object for the world's camera. Can be used to get to low-level info
   * about the camera such as its various matrices, but be careful not to make modifications
   * to the camera as that can lead to things getting out of sync.
   * @returns {Camera3DFacade}
   */
  getCameraFacade() {
    notifyWorldGetter.value = null
    this.notifyWorld('getCameraFacade', notifyWorldGetter)
    return notifyWorldGetter.value
  }

  /**
   * Calculate the distance in world units between this object's origin and the camera.
   * @returns {Number}
   */
  getCameraDistance() {
    let cameraPos = this.getCameraPosition(singletonVec3b)
    let objectPos = this.getWorldPosition(singletonVec3)
    return cameraPos.distanceTo(objectPos)
  }

  /**
   * Get the current projected user space position for this object, or for a specific position
   * in its object space.
   * @returns {Vector3} x and y are in screen pixels, z is worldspace distance from camera. The
   *                    z may be negative, which means it is out of view behind the camera.
   */
  getProjectedPosition(x, y, z) {
    this.updateMatrices()
    notifyWorldGetter.value = null
    notifyWorldGetter.worldPosition = singletonVec3.set(x || 0, y || 0, z || 0).applyMatrix4(this.threeObject.matrixWorld)
    this.notifyWorld('projectWorldPosition', notifyWorldGetter)
    return notifyWorldGetter.value
  }

  /**
   * Get the facade object for the world's scene.
   * @returns {Scene3DFacade}
   */
  getSceneFacade() {
    notifyWorldGetter.value = null
    this.notifyWorld('getSceneFacade', notifyWorldGetter)
    return notifyWorldGetter.value
  }

  /**
   * Return a {@link Sphere} encompassing the bounds of this object in worldspace, or `null` if
   * it has no physical bounds. This is used for optimized raycasting.
   *
   * The default implementation attempts to be as efficient as possible, only updating the sphere
   * when necessary, and assumes the threeObject has a geometry that accurately describes its bounds.
   * Override this method to provide custom bounds calculation logic, for example when additional meshes
   * need to be checked or a vertex shader manipulates the geometry; you'll probably also need to override
   * {@link #raycast} to match.
   *
   * TODO: this needs to be easier to override without having to reimplement large chunks of logic
   */
  getBoundingSphere() {
    // Get the geometry's current bounding sphere
    let geomSphere = this._getGeometryBoundingSphere()
    if (!geomSphere) return null

    // Ensure world matrix is up to date
    this.updateMatrices()

    // Lazily create our Sphere
    let sphere = this._boundingSphere
    if (!sphere) {
      sphere = this._boundingSphere = new Sphere()
    }

    // If the geometry, the geometry's bounding sphere, or this object's world matrix changed,
    // update our bounding sphere to match them.
    if (sphere._geometrySphereVersion !== geomSphere.version || sphere._worldMatrixVersion !== this._worldMatrixVersion) {
      sphere.copy(geomSphere)
      sphere.applyMatrix4(this.threeObject.matrixWorld)
      sphere._worldMatrixVersion = this._worldMatrixVersion
      sphere._geometrySphereVersion = geomSphere.version
    }

    return sphere
  }

  /**
   * Ensure the object's geometry, if any, has an up-to-date bounding Sphere, and return that Sphere.
   * The returned Sphere will be assigned a unique `version` property when it is modified, which can
   * be used elsewhere for tracking changes.
   * @private
   */
  _getGeometryBoundingSphere() {
    const geometry = this.getGeometry()
    if (geometry) {
      let geomSphere = geometry.boundingSphere
      let geomSphereChanged = false
      if (geomSphere) {
        if (geometry.isBufferGeometry) {
          // For a BufferGeometry we can look at the `position` attribute's `version` (incremented
          // when the user sets `geom.needsUpdate = true`) to detect the need for bounds recalc
          const posAttr = geometry.attributes.position
          if (posAttr && geomSphere._posAttrVersion !== posAttr.version) {
            geometry.computeBoundingSphere()
            geomSphere._posAttrVersion = posAttr.version
            geomSphereChanged = true
          }
        } else {
          // For a non-buffer Geometry (not recommended!) users will have to manually call
          // `geom.computeBoundingSphere()` after changing its vertices, and we'll do a brute force
          // check for changes to the sphere's properties
          if (!geometry._lastBoundingSphere || !geomSphere.equals(geometry._lastBoundingSphere)) {
            geometry._lastBoundingSphere = geomSphere.clone()
            geomSphereChanged = true
          }
        }
      } else {
        geometry.computeBoundingSphere()
        geomSphere = geometry.boundingSphere
        geomSphereChanged = true
      }
      if (geomSphereChanged) {
        geomSphere.version = ++_geometrySphereVersion
      }
      return geomSphere
    } else {
      return null
    }
  }

  /**
   * @protected Extension point for subclasses that don't use their threeObject's geometry, e.g. Instanceable
   */
  getGeometry() {
    const obj = this.threeObject
    return obj && obj.geometry
  }

  /**
   * Determine if this facade's threeObject intersects a Raycaster. Override this method to provide
   * custom raycasting logic, for example when additional meshes need to be checked or a vertex shader
   * manipulates the geometry; you'll probably also need to override {@link #getBoundingSphere} to match.
   *
   * The return value can be:
   *   - An array of hit objects for this facade, matching the format returned by `Raycaster.intersectObject`
   *   - `null`, if this facade has no hits
   */
  raycast(raycaster) {
    return this.threeObject ? this._raycastObject(this.threeObject, raycaster) : null
  }

  /**
   * Custom optimized raycast that, unlike Raycaster.intersectObject(), avoids creating a
   * new array unless there are actually hits. It also supports the custom `raycastSide`
   * override property, hit on sides other than the material's configured `side`.
   * @protected
   */
  _raycastObject(obj, raycaster) {
    if (obj.visible) {
      singletonIntersects.length = 0
      let origSide = null
      const raycastSide = this.raycastSide
      if (raycastSide != null) {
        origSide = obj.material.side
        obj.material.side = raycastSide
      }
      obj.raycast(raycaster, singletonIntersects)
      if (origSide !== null) {
        obj.material.side = origSide
      }
      if (singletonIntersects.length) {
        singletonIntersects.sort(ascDistanceSort)
        return singletonIntersects.slice()
      }
    }
    return null
  }

  _addToThreeObjectTree() {
    let parent = this._parentObject3DFacade
    if (parent) {
      if (this.threeObject.parent !== parent.threeObject) {
        parent.threeObject.add(this.threeObject)
        parent._addToThreeObjectTree()
      }
    }
  }

  _queueRemoveChildObject3D(threeObjectId) {
    let removeChildIds = this._removeChildIds || (this._removeChildIds = Object.create(null))
    removeChildIds[threeObjectId] = true
  }

  destructor() {
    this.notifyWorld('object3DRemoved')
    let parentObj3D = this._parentObject3DFacade
    if (parentObj3D) {
      parentObj3D._queueRemoveChildObject3D(this.threeObject.id)
    }
    delete this.threeObject
    super.destructor()
  }
}


// Convenience setters for Object3D simple properties
;['castShadow', 'receiveShadow', 'renderOrder', 'visible'].forEach(prop => {
  Object.defineProperty(Object3DFacade.prototype, prop, {
    get() {
      return this.threeObject[prop]
    },
    set(value) {
      this.threeObject[prop] = value
    }
  })
})

/**
 * @property {null|number} raycastSide
 * Hook to force a different `side` than that of the material for mesh raycasting.
 * Should be set to `FrontSide`|`BackSide`|`DoubleSide`, or `null` to use the
 * material's side.
 */
Object3DFacade.prototype.raycastSide = null


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
  return this.threeObject.${aspect}.${attr}
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

// ...and a special shortcut for uniform scale
Object.defineProperty(Object3DFacade.prototype, 'scale', {
  get() {
    // can't guarantee scale was already uniform, so just use scaleX arbitrarily
    return this.threeObject.scale.x
  },
  set(value) {
    const scaleObj = this.threeObject.scale
    if (value !== scaleObj.x || value !== scaleObj.y || value !== scaleObj.z) {
      scaleObj.x = scaleObj.y = scaleObj.z = value
      if (!this._matrixChanged) {
        this._matrixChanged = true
      }
    }
  }
})


Object.defineProperty(Object3DFacade.prototype, 'isObject3DFacade', {value: true})

// Predefine shape to facilitate JS engine optimization
assign(Object3DFacade.prototype, {
  threeObject: null,
  _parentObject3DFacade: null,
  _removeChildIds: null,
  _matrixChanged: true,
  _worldMatrixVersion: -1,
  _worldMatrixVersionAfterLastUpdate: -1,
  _boundingSphereChanged: false
})

// Define onBeforeRender/onAfterRender event handler properties
Facade.defineEventProperty(Object3DFacade, 'onBeforeRender', 'beforerender')
Facade.defineEventProperty(Object3DFacade, 'onAfterRender', 'afterrender')


export default Object3DFacade
