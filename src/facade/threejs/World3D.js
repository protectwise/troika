import {assign} from '../../utils'
import {WebGLRenderer, Raycaster, Color, Vector2, Vector3} from 'three'
import WorldBaseFacade from '../WorldBase'
import Scene3DFacade from './Scene3D'
import {PerspectiveCamera3DFacade} from './Camera3D'
import {BoundingSphereOctree} from './BoundingSphereOctree'


const posVec = new Vector3()
const raycaster = new Raycaster()



class World3DFacade extends WorldBaseFacade {
  constructor(canvas, threeJsRendererConfig = {}) {
    super(canvas)

    let RendererClass = threeJsRendererConfig.rendererClass || WebGLRenderer
    this._threeRenderer = new RendererClass(assign({
      canvas: canvas,
      alpha: true
    }, threeJsRendererConfig))

    this._object3DFacadesById = Object.create(null)
  }

  set backgroundColor(color) {
    if (color !== this._bgColor) {
      this._threeRenderer.setClearColor(new Color(color || 0), color != null ? 1 : 0)
      this._bgColor = color
    }
  }
  get backgroundColor() {
    return this._bgColor
  }

  set shadows(val) {
    this._threeRenderer.shadowMap.enabled = !!val
  }

  afterUpdate() {
    let {camera, scene, width, height} = this
    camera.key = 'camera'
    camera.facade = camera.facade || PerspectiveCamera3DFacade
    if (typeof camera.aspect !== 'number') {
      camera.aspect = width / height
    }
    scene.key = 'scene'
    scene.facade = scene.facade || Scene3DFacade
    this.children = [camera, scene]

    let renderer = this._threeRenderer

    let pixelRatio = this.pixelRatio || window.devicePixelRatio || 1
    if (renderer.getPixelRatio() !== pixelRatio) {
      renderer.setPixelRatio(pixelRatio)
    }

    let lastSize = renderer.getSize()
    if (lastSize.width !== width || lastSize.height !== height) {
      renderer.setSize(width, height, true)
    }

    super.afterUpdate()
  }

  doRender() {
    let sceneFacade = this.getChildByKey('scene')
    let scene = sceneFacade.threeObject
    let camera = this.getChildByKey('camera').threeObject
    let renderer = this._threeRenderer

    // Invoke any onBeforeRender listeners
    let registry = this.eventRegistry
    function invokeHandler(handler) {
      handler(renderer, scene, camera)
    }
    registry.forEachListenerOfType('onBeforeRender', invokeHandler, this)

    // Render scene
    renderer.render(scene, camera)

    // Invoke any onAfterRender listeners
    registry.forEachListenerOfType('onAfterRender', invokeHandler, this)

    let onStatsUpdate = this.onStatsUpdate
    if (onStatsUpdate) {
      let info = renderer.info.render
      onStatsUpdate({
        'WebGL Draw Calls': info.calls,
        'WebGL Vertices': info.vertices,
        'WebGL Triangles': info.faces
      })
    }
  }

  /**
   * Implementation of abstract
   */
  getFacadeUserSpaceXYZ(facade) {
    let matrixEls = facade.threeObject.matrixWorld.elements
    return this.projectWorldPosition(matrixEls[12], matrixEls[13], matrixEls[14])
  }

  projectWorldPosition(x, y, z) {
    posVec.set(x, y, z)
    let camera = this.getChildByKey('camera').threeObject

    // Make position relative to camera
    posVec.applyMatrix4(camera.matrixWorldInverse)

    // Get relative distance to the point, negative if it's behind the camera
    let signedDistance = posVec.length() * (posVec.z > 0 ? -1 : 1)

    // Project x/y to screen coords
    posVec.applyMatrix4(camera.projectionMatrix)
    let screenX = (posVec.x + 1) * this.width / 2
    let screenY = (1 - posVec.y) * this.height / 2

    return new Vector3(screenX, screenY, signedDistance)
  }


  /**
   * Implementation of abstract
   */
  getFacadesAtPosition(clientX, clientY, canvasRect) {
    // convert mouse position to normalized device coords (-1 to 1)
    let coords = new Vector2(
      (clientX - canvasRect.left) / canvasRect.width * 2 - 1,
      (clientY - canvasRect.top) / canvasRect.height * -2 + 1
    )

    // ensure camera's matrix is updated
    let camera = this.getChildByKey('camera').threeObject
    camera.updateMatrixWorld()

    // prep raycaster
    raycaster.setFromCamera(coords, camera)
    return this.getFacadesOnRay(raycaster.ray, raycaster.near, raycaster.far)
  }

  getFacadesOnRay(ray, near, far) {
    // update bounding sphere octree
    const octree = this._updateOctree()

    // search bounding sphere octree to quickly filter down to a small set of likely hits,
    // then do a true raycast on those facades
    let allHits = null
    if (octree) {
      raycaster.ray = ray
      raycaster.near = near || 0
      raycaster.far = far || Infinity
      octree.forEachSphereOnRay(ray, (sphere, facadeId) => {
        const facadesById = this._object3DFacadesById
        const facade = facadesById && facadesById[facadeId]
        const hits = facade && facade.raycast && facade.raycast(raycaster)
        if (hits && hits[0]) {
          (allHits || (allHits = [])).push({
            facade: facade,
            distance: hits[0].distance //ignore all but closest
          })
        }
      })
    }
    return allHits
  }

  _updateOctree() {
    // update octree with any new bounding spheres
    let octree = this._boundingSphereOctree
    const changes = this._octreeChangeset
    if (changes) {
      if (!octree) {
        octree = this._boundingSphereOctree = new BoundingSphereOctree()
      }
      const {remove, put} = changes
      if (remove) {
        for (let facadeId in remove) {
          octree.removeSphere(facadeId)
        }
      }
      if (put) {
        for (let facadeId in put) {
          // Check for put requests for objects that are now obsolete
          const facade = this._object3DFacadesById[facadeId]
          if (facade && !facade.isDestroying && !(remove && remove[facadeId])) {
            const sphere = facade.getBoundingSphere()
            if (sphere) {
              octree.putSphere(facadeId, sphere)
            } else {
              octree.removeSphere(facadeId)
            }
          }
        }
      }
      this._octreeChangeset = null
    }
    return octree
  }

  _queueForOctreeChange(changeType, facade) {
    const changes = this._octreeChangeset || (this._octreeChangeset = {})
    const map = changes[changeType] || (changes[changeType] = Object.create(null))
    map[facade.$facadeId] = facade
  }

  destructor() {
    super.destructor()
    this._threeRenderer.dispose()
    this._threeRenderer.forceContextLoss()
  }

}



World3DFacade.prototype._notifyWorldHandlers = assign(
  Object.create(WorldBaseFacade.prototype._notifyWorldHandlers),
  {
    getCameraPosition(source, data) {
      data.callback(this.getChildByKey('camera').threeObject.position)
    },
    getCameraFacade(source, data) {
      data.callback(this.getChildByKey('camera'))
    },
    projectWorldPosition(source, data) {
      let pos = data.worldPosition
      data.callback(this.projectWorldPosition(pos.x, pos.y, pos.z))
    },
    object3DAdded(source) {
      this._object3DFacadesById[source.$facadeId] = source
      this._queueForOctreeChange('put', source)
    },
    object3DBoundsChanged(source) {
      this._queueForOctreeChange('put', source)
    },
    object3DRemoved(source) {
      delete this._object3DFacadesById[source.$facadeId]
      this._queueForOctreeChange('remove', source)
    }
  }
)


export default World3DFacade
