import {assign, assignIf} from '../../utils'
import {InstancedBufferAttribute, InstancedBufferGeometry, ShaderLib} from 'three'
import Group3DFacade from './Group3D'
import {upgradeShaders, getUniformsTypes} from './InstancingShaderUpgrades'


const INSTANCE_BATCH_SIZE = 1024 //TODO make this an option?


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
    this.onBeforeRender = this._setupBatchObjects.bind(this)
    this.onAfterRender = this._teardownBatchObjects.bind(this)
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

    // Short-lived caches within this render pass
    this._batchKeysByObjectId = Object.create(null)
    this._instanceUniformsTypesByMaterial = Object.create(null)

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
            for (let row = 0; row < 3; row++) {
              batchGeometry._instanceMatrixAttrs[row].needsUpdate = true
            }
            if (instanceUniforms) {
              for (let i = instanceUniforms.length; i--;) {
                batchGeometry.attributes[`troika_${instanceUniforms[i]}`].needsUpdate = true
              }
            }
            batchObjects.push(batchObject)
          }

          // Put the instance's world matrix into the batch geometry's instancing attributes
          let attrOffset = batchGeometry.maxInstancedCount++
          let attrs = batchGeometry._instanceMatrixAttrs
          let elements = instanceObject.matrixWorld.elements //column order
          for (let row = 0; row < 3; row++) {
            attrs[row].setXYZW(
              attrOffset, elements[row], elements[row + 4], elements[row + 8], elements[row + 12]
            )
          }

          // Put the instance's values for instanceUniforms into the corresponding attributes
          if (instanceUniforms) {
            for (let i = instanceUniforms.length; i--;) {
              let uniform = instanceUniforms[i]
              let attr = batchGeometry.attributes[`troika_${uniform}`]
              let value = (uniform in facade._instanceUniforms) ? facade._instanceUniforms[uniform] : getShadersForMaterial(protoObject.material).uniforms[uniform].value //TODO clean up
              setAttributeValue(attr, attrOffset, value)
            }
          }

          // Save pointers for possible reuse next frame
          facade._instancingBatchIndex = batchObjects.length - 1
          facade._instancingBatchAttrOffset = attrOffset
        } else {
          facade._instancingBatchIndex = facade._instancingBatchAttrOffset = null
        }
      }

      // Dispose any old batch geometries that were unused during this render pass
      // TODO should this be delayed any to prevent thrashing?
      geometryPool.disposeUnused()
    }

    // Add the batch objects to the scene
    let count = 0
    for (let id in batchObjectsByKey) {
      scene.children.push.apply(scene.children, batchObjectsByKey[id])
      count += batchObjectsByKey[id].length
    }
    //console.log(`Rendered ${count} batch instancing objects`)

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
      let batchIndex = facade._instancingBatchIndex
      let attrOffset = facade._instancingBatchAttrOffset
      if (protoObject && batchIndex !== null && attrOffset !== null) {
        let batchObjects = this._batchObjectsByKey[this._getBatchKey(protoObject)]
        if (batchObjects) {
          let batchObject = batchObjects[batchIndex]
          if (batchObject) {
            let attrs = batchObject.geometry._instanceMatrixAttrs
            let elements = facade.threeObject.matrixWorld.elements
            for (let row = 0; row < 3; row++) {
              attrs[row].setXYZW(attrOffset, elements[row], elements[row + 4], elements[row + 8], elements[row + 12])
              attrs[row].needsUpdate = true
            }
            return //success
          }
        }
      }
      // Fallback just in case something didn't line up above - clear pointers and trigger rebatch
      this._needsRebatch = true
    }
  }

  _onInstanceUniformChanged(facade, uniformName) {
    if (!this._needsRebatch) {
      let protoObject = facade.instancedThreeObject
      let batchIndex = facade._instancingBatchIndex
      let attrOffset = facade._instancingBatchAttrOffset
      if (protoObject && batchIndex !== null && attrOffset !== null) {
        let batchObjects = this._batchObjectsByKey[this._getBatchKey(protoObject)]
        if (batchObjects) {
          let batchObject = batchObjects[batchIndex]
          if (batchObject) {
            let attr = batchObject.geometry.attributes[`troika_${uniformName}`]
            setAttributeValue(attr, attrOffset, facade._instanceUniforms[uniformName])
            attr.needsUpdate = true
            return //success
          }
        }
      }
      // Fallback just in case something didn't line up above - clear pointers and trigger rebatch
      this._needsRebatch = true
    }
  }

  _getBatchKey(object) {
    let cache = this._batchKeysByObjectId
    let key = cache[object.id]
    if (!key) {
      let mat = object.material
      let shaders = getShadersForMaterial(mat)
      let uniforms = mat.instanceUniforms
      key = `${object.geometry.id}|${mat.id}|${shaders.vertexShader}|${shaders.fragmentShader}|${uniforms ? uniforms.sort().join(',') : ''}`
      cache[object.id] = key
    }
    return key
  }

  _getInstanceUniformsTypes(material) {
    let cache = this._instanceUniformsTypesByMaterial
    let result = cache[material.id]
    if (!result) {
      result = cache[material.id] = Object.create(null)
      let {instanceUniforms} = material
      if (instanceUniforms && instanceUniforms.length) {
        let {vertexShader, fragmentShader} = getShadersForMaterial(material)
        let allTypes = assign(getUniformsTypes(vertexShader), getUniformsTypes(fragmentShader)) //TODO handle type mismatches?
        for (let i = instanceUniforms.length; i--;) {
          let uniform = instanceUniforms[i]
          if (allTypes[uniform]) {
            result[uniform] = allTypes[uniform]
          }
        }
      }
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
    let uniformsTypes = this._getInstanceUniformsTypes(material)
    let batchGeometry = this._batchGeometryPool.borrow(batchKey, geometry, uniformsTypes)
    batchGeometry.maxInstancedCount = 0

    // Upgrade the material to one with the shader modifications and defines to trigger instancing
    let batchMaterial = Object.create(material)
    let instUniforms = material.instanceUniforms || []
    instUniforms.sort()
    batchMaterial.defines = assignIf({
      [`TROIKA_INSTANCED_${instUniforms.join('_')}`]: '' //unique define value to trigger compilation for different sets of instanceUniforms
    }, batchMaterial.defines)
    batchMaterial.onBeforeCompile = function(shaderInfo) {
      // Upgrade the material's shaders to support instanced matrices and other uniforms
      // This will be called on program change even after first compile, so cache after first run
      let upgraded = material.$troikaUpgraded
      let upgradeKey = `${shaderInfo.vertexShader}|${shaderInfo.fragmentShader}|${instUniforms.join(',')}`
      if (!upgraded || upgraded.upgradeKey !== upgradeKey) {
        upgraded = material.$troikaUpgraded = upgradeShaders(shaderInfo.vertexShader, shaderInfo.fragmentShader, instUniforms)
        upgraded.upgradeKey = upgradeKey
      }
      assign(shaderInfo, upgraded)
    }

    // Create a new mesh object to hold it all
    let batchObject = Object.create(instancedObject)
    batchObject.$troikaBatchBaseObj = instancedObject
    batchObject.$troikaInstancingManager = this
    batchObject.visible = true
    batchObject.frustumCulled = false
    batchObject.geometry = batchGeometry
    batchObject.material = batchMaterial
    return batchObject
  }
  
  _teardownBatchObjects(renderer, scene, camera) {
    // Release geometries to the pool for next time
    this._batchGeometryPool.releaseAll()

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

  borrow(key, baseGeometry, uniformsTypes) {
    let poolsByKey = this._poolsByKey
    let pool = poolsByKey[key] || (poolsByKey[key] = {geometries: [], firstFree: 0})
    let batchGeometry = pool.geometries[pool.firstFree++]

    if (!batchGeometry) {
      batchGeometry = new InstancedBufferGeometry()
      assign(batchGeometry, baseGeometry)
      batchGeometry.attributes = assign({}, baseGeometry.attributes)

      // Create instancing attributes for the modelMatrix's rows
      batchGeometry._instanceMatrixAttrs = []
      for (let row = 0; row < 3; row++) {
        let attr = new InstancedBufferAttribute(new Float32Array(INSTANCE_BATCH_SIZE * 4), 4)
        attr.dynamic = true
        batchGeometry.attributes[`troika_modelMatrixRow${row}`] = attr
        batchGeometry._instanceMatrixAttrs.push(attr) //for quicker lookup
      }

      // Create instancing attributes for the instanceUniforms
      for (let name in uniformsTypes) {
        let type = uniformsTypes[name]
        let itemSize = ATTR_ITEM_SIZES[type]
        let ArrayType = type === 'int' ? Uint32Array : Float32Array
        let attr = new InstancedBufferAttribute(new ArrayType(INSTANCE_BATCH_SIZE * itemSize), itemSize)
        attr.dynamic = true
        batchGeometry.attributes[`troika_${name}`] = attr
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



const ATTR_ITEM_SIZES = {
  'int': 1,
  'float': 1,
  'vec2': 2,
  'vec3': 3,
  'vec4': 4
}


// Copied from threejs WebGLPrograms.js so we can resolve builtin materials to their shaders
// TODO how can we keep this from getting stale?
const MATERIAL_TYPES_TO_SHADERS = {
  MeshDepthMaterial: 'depth',
  MeshNormalMaterial: 'normal',
  MeshBasicMaterial: 'basic',
  MeshLambertMaterial: 'lambert',
  MeshPhongMaterial: 'phong',
  MeshToonMaterial: 'phong',
  MeshStandardMaterial: 'physical',
  MeshPhysicalMaterial: 'physical',
  LineBasicMaterial: 'basic',
  LineDashedMaterial: 'dashed',
  PointsMaterial: 'points'
}

function getShadersForMaterial(material) {
  return material.isShaderMaterial ? material : ShaderLib[MATERIAL_TYPES_TO_SHADERS[material.type]] //TODO fallback for unknown type?
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




export default InstancingManager
