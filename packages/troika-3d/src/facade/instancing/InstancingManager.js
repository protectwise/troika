import { utils } from 'troika-core'
import {
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Matrix4
} from 'three'
import Group3DFacade from '../Group3DFacade.js'
import { getInstancingDerivedMaterial } from './InstancingDerivedMaterial.js'
import { getShadersForMaterial } from 'troika-three-utils'

const { assign } = utils

const INSTANCE_BATCH_SIZE = 128 //TODO make this an option?
const DYNAMIC_DRAW = 0x88E8 //can't import DynamicDrawUsage from three without breaking older versions

/**
 * An InstancingManager handles aggregating all Instanceable3DFacade descendants into
 * instancing batches. For each batch it creates a clone of the instancedThreeObject,
 * populates a pooled InstancedBufferGeometry with buffer attributes holding the world
 * matrices of all the batch's instances, and temporarily inserts that into the
 * scene to be rendered.
 *
 * As an additional "turbo" optimization, the instancing batch objects/geometries will be
 * reused untouched between rendering frames if none of the managed Instanceable3DFacade
 * objects have changed in a way that would affect the batches or world matrix attributes.
 *
 * There is a global InstancingManager automatically added to the main scene, and it does
 * nothing if there are no Instanceable3DFacades in the scene, so in most cases you should
 * not need to touch this yourself. But it is also possible to insert additional
 * InstancingManager facades further down in the scene if you wish to control the scope
 * of instancing, e.g. to increase the likelihood of the aforementioned "turbo" optimization
 * kicking in.
 *
 * Also see InstancingShaderUpgrades, which modifies material shaders so they accept the matrix
 * and custom uniform values coming in as attributes. This allows built-in materials as well
 * as custom shaders to work with instancing without manual modification.
 */
class InstancingManager extends Group3DFacade {
  constructor(parent) {
    super(parent)
    this._instanceables = Object.create(null)
    this._batchGeometryPool = new BatchGeometryPool()
    this._needsRebatch = true
    this.addEventListener('beforerender', this._setupBatchObjects.bind(this))
    this.addEventListener('afterrender', this._teardownBatchObjects.bind(this))
  }

  onNotifyWorld(source, message, data) {
    let handler = this._notifyWorldHandlers[message]
    if (handler) {
      handler.call(this, source, data)
    } else if (this.parent) {
      this.parent.onNotifyWorld(source, message, data)
    }
  }

  _setupBatchObjects(renderer, scene, camera) {
    let instanceables = this._instanceables
    let batchObjectsByKey = this._batchObjectsByKey
    let needsRebatch = this._needsRebatch

    if (!needsRebatch) {
      // We'll already know about most types of changes (instanceable addition/removal, instancedThreeObject
      // changes, matrix changes) but if any of the instancedThreeObjects changed their geometry or material
      // internally we'll need to detect that here and deoptimize.
      for (let key in batchObjectsByKey) {
        let batchObj = batchObjectsByKey[key][0]
        if (this._getBatchKey(batchObj.$troikaBatchBaseObj) !== key) {
          needsRebatch = true
          break
        }
      }
    }

    if (needsRebatch) {
      batchObjectsByKey = this._batchObjectsByKey = Object.create(null)
      let geometryPool = this._batchGeometryPool
      for (let facadeId in instanceables) {
        let facade = instanceables[facadeId]
        let instanceObject = facade.threeObject
        let protoObject = facade.instancedThreeObject

        if (protoObject && instanceObject.visible) {
          // Find or create the batch object for this facade's instancedThreeObject
          let batchKey = this._getBatchKey(protoObject)
          let instanceUniforms = protoObject.material.instanceUniforms
          let batchObjects = batchObjectsByKey[batchKey] || (batchObjectsByKey[batchKey] = [])
          let batchObject = batchObjects[batchObjects.length - 1]
          let batchGeometry = batchObject && batchObject.geometry
          if (!batchGeometry || batchGeometry.maxInstancedCount === INSTANCE_BATCH_SIZE) {
            batchObject = this._getBatchObject(protoObject)
            batchGeometry = batchObject.geometry
            let attrs = batchGeometry._instanceAttrs.matrix
            for (let row = 0; row < 3; row++) {
              attrs[row].version++
            }
            if (instanceUniforms) {
              attrs = batchGeometry._instanceAttrs.uniforms
              for (let i = instanceUniforms.length; i--;) {
                attrs[instanceUniforms[i]].version++
              }
            }
            batchObjects.push(batchObject)
          }

          // Put the instance's world matrix into the batch geometry's instancing attributes
          let attrOffset = batchGeometry.maxInstancedCount++
          let attrs = batchGeometry._instanceAttrs.matrix
          let elements = instanceObject.matrixWorld.elements //column order
          attrs[0].setXYZW(attrOffset, elements[0], elements[4], elements[8], elements[12])
          attrs[1].setXYZW(attrOffset, elements[1], elements[5], elements[9], elements[13])
          attrs[2].setXYZW(attrOffset, elements[2], elements[6], elements[10], elements[14])

          // Put the instance's values for instanceUniforms into the corresponding attributes
          if (instanceUniforms) {
            attrs = batchGeometry._instanceAttrs.uniforms
            for (let i = instanceUniforms.length; i--;) {
              let uniform = instanceUniforms[i]
              let attr = attrs[uniform]
              let facadeUniforms = facade._instanceUniforms
              let value = facadeUniforms && (uniform in facadeUniforms) ?
                facadeUniforms[uniform] : getDefaultUniformValue(protoObject.material, uniform)
              setAttributeValue(attr, attrOffset, value)
            }
          }

          // Save pointers for possible reuse next frame
          facade._instancingBatchObject = batchObject
          facade._instancingBatchAttrOffset = attrOffset
        } else {
          facade._instancingBatchObject = facade._instancingBatchAttrOffset = null
        }
      }

      // Dispose any old batch geometries that were unused during this render pass
      // TODO should this be delayed any to prevent thrashing?
      geometryPool.disposeUnused()
    }

    // Add the batch objects to the scene
    let batchCount = 0
    let batchGrpCount = 0
    let instanceCount = 0
    for (let id in batchObjectsByKey) {
      let batchObjects = batchObjectsByKey[id]
      scene.children.push.apply(scene.children, batchObjects)

      // increment stats
      batchGrpCount++
      for (let i = batchObjects.length; i--;) {
        batchCount++
        instanceCount += batchObjects[i].geometry.maxInstancedCount
      }
    }

    this.notifyWorld('statsUpdate', {
      'Instancing Batch Groups': batchGrpCount,
      'Instancing Batches': batchCount,
      'Instanced Objects': instanceCount
    })

    this._needsRebatch = false
  }

  _onInstanceAdded(facade) {
    this._instanceables[facade.$facadeId] = facade
    this._needsRebatch = true
  }

  _onInstanceRemoved(facade) {
    delete this._instanceables[facade.$facadeId]
    this._needsRebatch = true
  }

  _onInstanceChanged(facade) {
    this._needsRebatch = true
  }

  _onInstanceMatrixChanged(facade) {
    // If a single instance's matrix changed and the batches are still otherwise valid, avoid a
    // full rebatch by updating just this instance's values in the matrix attributes directly.
    if (!this._needsRebatch) {
      let protoObject = facade.instancedThreeObject
      let batchObject = facade._instancingBatchObject
      let attrOffset = facade._instancingBatchAttrOffset
      if (protoObject && batchObject && this._getBatchKey(protoObject) === this._getBatchKey(batchObject)) {
        let attrs = batchObject.geometry._instanceAttrs.matrix
        let elements = facade.threeObject.matrixWorld.elements
        attrs[0].setXYZW(attrOffset, elements[0], elements[4], elements[8], elements[12]).version++
        attrs[1].setXYZW(attrOffset, elements[1], elements[5], elements[9], elements[13]).version++
        attrs[2].setXYZW(attrOffset, elements[2], elements[6], elements[10], elements[14]).version++
      } else {
        // Fallback just in case something didn't line up above - clear pointers and trigger rebatch
        facade._instancingBatchObject = facade._instancingBatchAttrOffset = null
        this._needsRebatch = true
      }
    }
  }

  _onInstanceUniformChanged(facade, uniformName) {
    if (!this._needsRebatch) {
      let protoObject = facade.instancedThreeObject
      let batchObject = facade._instancingBatchObject
      if (protoObject && batchObject && this._getBatchKey(protoObject) === this._getBatchKey(batchObject)) {
        let attr = batchObject.geometry._instanceAttrs.uniforms[uniformName]
        setAttributeValue(attr, facade._instancingBatchAttrOffset, facade._instanceUniforms[uniformName])
        attr.version++ //skip setter
      } else {
        // Fallback just in case something didn't line up above - clear pointers and trigger rebatch
        facade._instancingBatchObject = facade._instancingBatchAttrOffset = null
        this._needsRebatch = true
      }
    }
  }

  _getBatchKey(object) {
    let cache = this._batchKeysCache || (this._batchKeysCache = Object.create(null)) //cache results for duration of this frame
    let key = cache && cache[object.id]
    if (!key) {
      let mat = object.material
      let uniforms = mat.instanceUniforms
      key = `${object.geometry.id}|${mat.id}|${uniforms ? uniforms.sort().join(',') : ''}`
      cache[object.id] = key
    }
    return key
  }

  _getInstanceUniformSizes(material) {
    // Cache results per material for duration of this frame
    let cache = this._uniformSizesCache || (this._uniformSizesCache = new Map())
    let result = cache.get(material)
    if (!result) {
      result = Object.create(null)
      if (material.instanceUniforms) {
        material.instanceUniforms.forEach(name => {
          let size = getUniformItemSize(material,  name)
          if (size > 0) {
            result[name] = size
          } else {
            console.warn(`Could not determine item size for uniform ${name}`)
          }
        })
      }
      cache.set(material, result)
    }
    return result
  }

  _getBatchObject(instancedObject) {
    let {geometry, material} = instancedObject

    // Upgrade the geometry to an instanced one
    if (!geometry.isBufferGeometry) {
      throw new Error('Instanceable proto object must use a BufferGeometry')
    }
    let batchKey = this._getBatchKey(instancedObject)
    let uniformSizes = this._getInstanceUniformSizes(material)
    let batchGeometry = this._batchGeometryPool.borrow(batchKey, geometry, uniformSizes)
    batchGeometry.maxInstancedCount = 0

    // Upgrade the material to one with the shader modifications for instancing
    let batchMaterial = getInstancingDerivedMaterial(material)
    let depthMaterial, distanceMaterial

    // Create a new mesh object to hold it all
    let batchObject = Object.create(instancedObject, {
      // Redefine properties rather than setting them so we don't inadvertently trigger setters on
      // the base object:
      geometry: { value: batchGeometry },
      material: { value: batchMaterial },
      visible: { value: true },
      frustumCulled: { value: false },

      // Lazy getters for shadow materials:
      customDepthMaterial: {
        get() {
          if (!depthMaterial) {
            depthMaterial = batchMaterial.getDepthMaterial()
            // We need to trick WebGLRenderer into setting the `viewMatrix` uniform, which it doesn't
            // normally do for MeshDepthMaterial but it's needed by the instancing shader code. It does
            // for ShaderMaterials so we pretend to be one.
            depthMaterial.isShaderMaterial = true
          }
          return depthMaterial
        }
      },
      customDistanceMaterial: {
        get() {
          if (!distanceMaterial) {
            distanceMaterial = batchMaterial.getDistanceMaterial()
            // We need to trick WebGLRenderer into setting the `viewMatrix` uniform, which it doesn't
            // normally do for MeshDistanceMaterial but it's needed by the instancing shader code. It does
            // for ShaderMaterials so we pretend to be one.
            distanceMaterial.isShaderMaterial = true

            // Additionally, WebGLShadowMap.render() rotates a single camera 6 times per object, which fails
            // to trigger the code in WebGLRenderer.setProgram() that updates the viewMatrix uniform for
            // directions 2 through 6. Since we need a correct viewMatrix in the instancing shader code,
            // we hack it by defining our own viewMatrix uniform on the distance material and manually
            // updating it before each view of the distance cube is rendered. Unfortunately intercepting the
            // view changes in a way that has access to the shadow camera's viewMatrix has proven quite
            // difficult; the least-awful way I've found is to monkeypatch the `modelViewMatrix.multiplyMatrices()`
            // function which is always called - see (*!) below.
            distanceMaterial.uniforms = assign({
              viewMatrix: { value: new Matrix4() }
            }, distanceMaterial.uniforms)
          }
          return distanceMaterial
        }
      },
      // (*!) Hack for updating viewMatrix uniform on the distance material - see explanation above.
      modelViewMatrix: {
        value: function() {
          const modelViewMatrix = new Matrix4()
          modelViewMatrix.multiplyMatrices = function(viewMatrix, matrixWorld) {
            if (distanceMaterial) {
              distanceMaterial.uniforms.viewMatrix.value.copy(viewMatrix)
              distanceMaterial.uniformsNeedUpdate = true //undocumented flag for ShaderMaterial
            }
            return Matrix4.prototype.multiplyMatrices.call(this, viewMatrix, matrixWorld)
          }
          return modelViewMatrix
        }()
      }
    })
    batchObject.$troikaBatchBaseObj = instancedObject
    batchObject.$troikaInstancingManager = this
    // NOTE other props are inherited so don't need to copy them
    return batchObject
  }

  _teardownBatchObjects(renderer, scene, camera) {
    // Release geometries to the pool for next time
    this._batchGeometryPool.releaseAll()

    // Clear caches from this render frame
    this._batchKeysCache = null
    this._uniformSizesCache = null

    // Remove batch objects from scene
    scene.children = scene.children.filter(obj => obj.$troikaInstancingManager !== this)
  }

  destructor() {
    let pool = this._batchGeometryPool
    pool.releaseAll()
    pool.disposeUnused()
    super.destructor()
  }
}


/**
 * Pool for the instancing batch geometries
 */
class BatchGeometryPool {
  constructor() {
    this._poolsByKey = Object.create(null)
  }

  borrow(key, baseGeometry, instanceUniformSizes) {
    let poolsByKey = this._poolsByKey
    let pool = poolsByKey[key] || (poolsByKey[key] = {geometries: [], firstFree: 0})
    let batchGeometry = pool.geometries[pool.firstFree++]

    if (!batchGeometry) {
      batchGeometry = new InstancedBufferGeometry()
      assign(batchGeometry, baseGeometry)
      batchGeometry.attributes = assign({}, baseGeometry.attributes)
      let instanceAttrs = batchGeometry._instanceAttrs = {matrix: [], uniforms: Object.create(null)} //separate collections for quicker lookup

      // Create instancing attributes for the modelMatrix's rows
      for (let row = 0; row < 3; row++) {
        let attr = new InstancedBufferAttribute(new Float32Array(INSTANCE_BATCH_SIZE * 4), 4)
        if (attr.setUsage) {
          attr.setUsage(DYNAMIC_DRAW)
        } else {
          attr.dynamic = true
        }
        batchGeometry.attributes[`troika_modelMatrixRow${row}`] = attr
        instanceAttrs.matrix[row] = attr
      }

      // Create instancing attributes for the instanceUniforms
      for (let name in instanceUniformSizes) {
        let itemSize = instanceUniformSizes[name]
        let attr = new InstancedBufferAttribute(new Float32Array(INSTANCE_BATCH_SIZE * itemSize), itemSize)
        if (attr.setUsage) {
          attr.setUsage(DYNAMIC_DRAW)
        } else {
          attr.dynamic = true
        }
        batchGeometry.attributes[`troika_${name}`] = attr
        instanceAttrs.uniforms[name] = attr
      }

      pool.geometries.push(batchGeometry)
    }

    return batchGeometry
  }

  releaseAll() {
    let pools = this._poolsByKey
    if (pools) {
      for (let key in pools) {
        pools[key].firstFree = 0
      }
    }
  }

  disposeUnused() {
    let pools = this._poolsByKey
    if (pools) {
      for (let key in pools) {
        let {firstFree, geometries} = pools[key]
        for (let i = firstFree, len = geometries.length; i < len; i++) {
          // Only allow the instancing attributes to be disposed; those copied from the
          // original geometry will be up to the author to dispose of properly
          let attrs = geometries[i].attributes
          for (let attrName in attrs) {
            if (attrs.hasOwnProperty(attrName) && attrName.indexOf('troika_') !== 0) {
              delete attrs[attrName]
            }
          }
          try {
            // can throw if it's already been disposed or hasn't yet been rendered
            geometries[i].dispose()
          } catch(e) {}
          geometries[i]._instanceAttrs = null
        }
        geometries.length = firstFree
      }
    }
  }
}


const proto = InstancingManager.prototype
proto._notifyWorldHandlers = {
  instanceableAdded: proto._onInstanceAdded,
  instanceableRemoved: proto._onInstanceRemoved,
  instanceableChanged: proto._onInstanceChanged,
  instanceableMatrixChanged: proto._onInstanceMatrixChanged,
  instanceableUniformChanged: proto._onInstanceUniformChanged
}


function setAttributeValue(attr, offset, value) {
  let size = attr.itemSize
  if (size === 1) {
    attr.setX(offset, value)
  }
  else if (size === 2) {
    attr.setXY(offset, value.x, value.y)
  }
  else if (size === 3) {
    if (value.isColor) {
      attr.setXYZ(offset, value.r, value.g, value.b)
    } else {
      attr.setXYZ(offset, value.x, value.y, value.z)
    }
  } else if (size === 4) {
    attr.setXYZW(offset, value.x, value.y, value.z, value.w)
  }
}

function getDefaultUniformValue(material, name) {
  // Try uniforms on the material itself, then try the builtin material shaders
  let uniforms = material.uniforms
  if (uniforms && uniforms[name]) {
    return uniforms[name].value
  }
  uniforms = getShadersForMaterial(material).uniforms
  if (uniforms && uniforms[name]) {
    return uniforms[name].value
  }
  return null
}

function getUniformItemSize(material, name) {
  return getItemSizeForValue(getDefaultUniformValue(material, name))
}

function getItemSizeForValue(value) {
  return value == null ? 0
    : typeof value === 'number' ? 1
    : value.isVector2 ? 2
    : (value.isVector3 || value.isColor) ? 3
    : value.isVector4 ? 4
    : Array.isArray(value) ? value.length
    : 0
}

export default InstancingManager
