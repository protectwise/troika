import {assign} from '../../utils'
import {InstancedBufferAttribute, InstancedBufferGeometry} from 'three'
import Group3DFacade from './Group3D'
import './InstancingShaderUpgrades'


const INSTANCE_BATCH_SIZE = 1024 //TODO make this an option?


/**
 * An InstancingManager handles aggregating all Instanceable3DFacade descendants into
 * instancing batches. For each batch it creates a clone of the instancedThreeObject,
 * populates a pooled InstancedBufferGeometry with buffer attributes holding the world
 * matrices of all the batch's instances, and temporarily inserts that into the
 * scene to be rendered.
 *
 * There is a global InstancingManager automatically added to the main scene, and it does
 * nothing if there are no Instanceable3DFacades in the scene, so in most cases you should
 * not need to touch this yourself. But it is also possible to insert additional
 * InstancingManager facades further down in the scene if you wish to control the scope
 * of instancing.
 *
 * Also see InstancingShaderUpgrades, which modifies all builtin ShaderChunks to support
 * grabbing the world matrices from the instancing attributes. This allows all builtin
 * materials to allow instancing out of the box; custom shaders can also work but may
 * require similar modifications.
 */
class InstancingManager extends Group3DFacade {
  constructor(parent) {
    super(parent)
    this._instanceables = Object.create(null)
    this._batchGeometryPool = new BatchGeometryPool()
    this.onBeforeRender = this._setupBatchObjects.bind(this)
    this.onAfterRender = this._teardownBatchObjects.bind(this)
  }

  onNotifyWorld(source, message, data) {
    switch (message) {
      case 'addInstanceable':
        this._instanceables[data.$facadeId] = data
        return
      case 'removeInstanceable':
        delete this._instanceables[data.$facadeId]
        return
    }
    super.onNotifyWorld(source, message, data)
  }

  _setupBatchObjects(renderer, scene, camera) {
    let instanceables = this._instanceables

    let batchObjects = Object.create(null)
    let geometryPool = this._batchGeometryPool
    for (let facadeId in instanceables) {
      let facade = instanceables[facadeId]
      let instanceObject = facade.threeObject
      let protoObject = facade.instancedThreeObject

      if (protoObject && instanceObject.visible) {
        // TODO perform frustum culling here?

        // Find or create the batch object for this facade's instancedThreeObject
        let batchObject = (batchObjects[protoObject.id] || (batchObjects[protoObject.id] = []))[0]
        let batchGeometry = batchObject && batchObject.geometry
        if (!batchGeometry || batchGeometry.maxInstancedCount === INSTANCE_BATCH_SIZE) {
          batchObject = this._getBatchObject(protoObject)
          batchGeometry = batchObject.geometry
          for (let row = 0; row < 3; row++) {
            batchGeometry._instanceMatrixAttrs[row].needsUpdate = true
          }
          batchObjects[protoObject.id].unshift(batchObject)
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
      }
    }

    // Dispose any old batch geometries that were unused during this render pass
    // TODO should this be delayed any to prevent thrashing?
    geometryPool.disposeUnused()

    // Add the batch objects to the scene
    let count = 0
    for (let id in batchObjects) {
      scene.children.push.apply(scene.children, batchObjects[id])
      count += batchObjects[id].length
    }
    //console.log(`Rendered ${count} batch instancing objects`)
  }

  _getBatchObject(instancedObject) {
    let {geometry, material} = instancedObject

    // Upgrade the geometry to an instanced one
    if (!geometry.isBufferGeometry) {
      throw new Error('Instanceable proto object must use a BufferGeometry')
    }
    let batchGeometry = this._batchGeometryPool.borrow(geometry)
    batchGeometry.maxInstancedCount = 0

    // Upgrade the material to one with the defines to trigger instancing
    let batchMaterial = Object.create(material)
    batchMaterial.defines = assign({}, batchMaterial.defines, {TROIKA_INSTANCED: ''})

    // Create a new mesh object to hold it all
    let batchObject = Object.create(instancedObject)
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
    this._poolsByGeometry = Object.create(null)
  }

  borrow(baseGeometry) {
    let poolsById = this._poolsByGeometry
    let pool = poolsById[baseGeometry.id] || (poolsById[baseGeometry.id] = {geometries: [], firstFree: 0})
    let batchGeometry = pool.geometries[pool.firstFree++]

    if (!batchGeometry) {
      batchGeometry = new InstancedBufferGeometry()
      assign(batchGeometry, baseGeometry)
      batchGeometry.attributes = assign({}, baseGeometry.attributes)
      batchGeometry._instanceMatrixAttrs = []
      for (let row = 0; row < 3; row++) {
        let attr = new InstancedBufferAttribute(new Float32Array(INSTANCE_BATCH_SIZE * 4), 4)
        attr.dynamic = true
        batchGeometry.attributes[`troikaInstanceModelMatrixRow${row}`] = attr
        batchGeometry._instanceMatrixAttrs.push(attr) //for quicker lookup
      }
      pool.geometries.push(batchGeometry)
      //console.log('added instancing geometry')
    }

    return batchGeometry
  }

  releaseAll() {
    let pools = this._poolsByGeometry
    if (pools) {
      for (let id in pools) {
        pools[id].firstFree = 0
      }
    }
  }

  disposeUnused() {
    let pools = this._poolsByGeometry
    if (pools) {
      for (let id in pools) {
        let {firstFree, geometries} = pools[id]
        for (let i = firstFree, len = geometries.length; i < len; i++) {
          // prevent the shared attributes (non-instancing ones) from being disposed unless it's the final geometry
          if (firstFree > 0) {
            let instancingAttrs = {}
            for (let row = 0; row < 3; row++) {
              let name = `troikaInstanceModelMatrixRow${row}`
              instancingAttrs[name] = geometries[i].attributes[name]
            }
          }
          geometries[i].dispose()
          //console.log('disposed instancing geometry')
        }
        geometries.length = firstFree
      }
    }
  }
}



export default InstancingManager
