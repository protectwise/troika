import { WorldBaseFacade, utils } from 'troika-core'
import {WebGLRenderer, Raycaster, Color, Vector2, Vector3} from 'three'
import Scene3DFacade from './Scene3DFacade.js'
import {PerspectiveCamera3DFacade} from './Camera3DFacade.js'
import {BoundingSphereOctree} from '../BoundingSphereOctree.js'

const { assign, assignIf } = utils
const tmpVec2 = new Vector2()
const tmpVec3 = new Vector3()
const raycaster = new Raycaster()


class World3DFacade extends WorldBaseFacade {
  constructor(canvas) {
    super(canvas)
    this._object3DFacadesById = Object.create(null)
    this._onBgClick = this._onBgClick.bind(this)
  }

  afterUpdate() {
    let {width, height, antialias, backgroundColor, contextAttributes, _element:canvas} = this

    // Set up renderer
    let renderer = this._threeRenderer
    const RendererClass = this.rendererClass || WebGLRenderer
    if (!renderer || !(renderer instanceof RendererClass)) {
      if (renderer) {
        renderer.dispose()
      }
      // Init the context manually so we can prefer webgl2
      contextAttributes = assign({
        alpha: true,
        antialias
      }, contextAttributes)
      const context = canvas.getContext('webgl2', contextAttributes) || undefined
      if (!context) {
        console.info('webgl2 init failed, trying webgl')
      }
      renderer = this._threeRenderer = new RendererClass(assign({
        canvas,
        context
      }, contextAttributes))
    }

    const shadows = this.shadows
    renderer.shadowMap.enabled = !!shadows
    if (shadows && typeof shadows === 'object') {
      assign(renderer.shadowMap, shadows)
    }

    if (backgroundColor !== this._bgColor) {
      this._threeRenderer.setClearColor(new Color(backgroundColor || 0), backgroundColor != null ? 1 : 0)
      this._bgColor = backgroundColor
    }

    // Update render canvas size
    this._updateDrawingBufferSize(width, height, this.pixelRatio || window.devicePixelRatio || 1)

    super.afterUpdate()
  }

  describeChildren() {
    return [
      this._getCameraDef(),
      this._getSceneDef()
    ]
  }

  /**
   * Build a normalized definition for the camera facade
   * @protected
   */
  _getCameraDef() {
    const {camera} = this
    return assign({
      key: 'camera',
      facade: PerspectiveCamera3DFacade,
      aspect: this.width / this.height
    }, camera)
  }

  /**
   * Build a normalized definition for the scene facade
   * @protected
   */
  _getSceneDef() {
    return {
      key: 'scene',
      facade: Scene3DFacade,
      lights: this.lights,
      objects: this.objects,
      fog: this.fog,
      onClick: this.onBackgroundClick ? this._onBgClick : null
    }
  }

  /**
   * Update the renderer's drawing buffer size
   * @protected
   */
  _updateDrawingBufferSize(width, height, pixelRatio) {
    const renderer = this._threeRenderer
    renderer.getSize(tmpVec2)
    if (tmpVec2.width !== width || tmpVec2.height !== height || renderer.getPixelRatio() !== pixelRatio) {
      renderer.setDrawingBufferSize(width, height, pixelRatio)
    }
  }

  doRender(/*...frameArgs*/) {
    let sceneFacade = this.getChildByKey('scene')
    let scene = sceneFacade.threeObject
    let camera = this.getChildByKey('camera').threeObject
    let renderer = this._threeRenderer

    // Invoke any onBeforeRender listeners
    let registry = this.eventRegistry
    function invokeHandler(handler, facadeId) {
      handler.call(this._object3DFacadesById[facadeId], renderer, scene, camera)
    }
    registry.forEachListenerOfType('beforerender', invokeHandler, this)

    // Render scene
    renderer.render(scene, camera)

    // Invoke any onAfterRender listeners
    registry.forEachListenerOfType('afterrender', invokeHandler, this)

    let onStatsUpdate = this.onStatsUpdate
    if (onStatsUpdate) {
      const {memory, render} = renderer.info
      const stats = {
        'WebGL Draw Calls': render.calls,
        'WebGL Geometries': memory.geometries,
        'WebGL Textures': memory.textures,
        'WebGL Triangles': render.triangles
      }
      if (render.points) {
        stats['WebGL Points'] = render.points
      }
      if (render.lines) {
        stats['WebGL Lines'] = render.lines
      }
      onStatsUpdate(stats)
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
    tmpVec3.set(x, y, z)
    let camera = this.getChildByKey('camera')
    camera.updateMatrices()
    camera = camera.threeObject

    // Make position relative to camera
    tmpVec3.applyMatrix4(camera.matrixWorldInverse)

    // Get relative distance to the point, negative if it's behind the camera
    let signedDistance = tmpVec3.length() * (tmpVec3.z > 0 ? -1 : 1)

    // Project x/y to screen coords
    tmpVec3.applyMatrix4(camera.projectionMatrix)
    let screenX = (tmpVec3.x + 1) * this.width / 2
    let screenY = (1 - tmpVec3.y) * this.height / 2

    return new Vector3(screenX, screenY, signedDistance)
  }

  /**
   * @override
   * In 3D worlds, we will normalize all pointer events so they always carry a `ray` property;
   * handlers for these events should then only rely on that, which is guaranteed to be present,
   * unlike `clientX/Y` etc. which are only present for pointer events originating from a screen.
   */
  _normalizePointerEvent(e) {
    // All pointer events in a 3D world will be given a `ray` property.
    if (!e.ray) {
      // normalize touch events
      let posInfo = e
      if (e.touches) {
        let touches = /^touch(end|cancel)$/.test(e.type) ? e.changedTouches : e.touches
        if (touches.length === 1) {
          posInfo = touches[0]
        }
      }

      // convert mouse position to normalized device coords (-1 to 1)
      const canvasRect = e.target.getBoundingClientRect() //e.target is the canvas
      let width = canvasRect.width || this.width //use logical size if no visible rect, e.g. offscreen canvas
      let height = canvasRect.height || this.height
      let u = ((posInfo.clientX || 0) - (canvasRect.left || 0)) / width * 2 - 1
      let v = ((posInfo.clientY || 0) - (canvasRect.top || 0)) / height * -2 + 1

      // ensure camera's matrix is up to date
      let camera = this.getChildByKey('camera')
      camera.updateMatrices()

      // calculate the ray and put it on the event
      e.ray = camera.getRayAtProjectedCoords(u, v)
    }

    super._normalizePointerEvent(e)
  }

  /**
   * @override Implementation of abstract
   * @return {Array<{facade, distance, ?distanceBias, ...}>|null}
   */
  getFacadesAtEvent(e, filterFn) {
    return e.ray ? this.getFacadesOnRay(e.ray, filterFn) : null
  }

  getFacadesOnRay(ray, filterFn) {
    // update bounding sphere octree
    const octree = this._updateOctree()

    // search bounding sphere octree to quickly filter down to a small set of likely hits,
    // then do a true raycast on those facades
    let allHits = null
    if (octree) {
      raycaster.ray = ray
      octree.forEachSphereOnRay(ray, (sphere, facadeId) => {
        const facadesById = this._object3DFacadesById
        const facade = facadesById && facadesById[facadeId]
        // let the filterFn eliminate things before trying to raycast them
        const hits = facade && (!filterFn || filterFn(facade)) && facade.raycast && facade.raycast(raycaster)
        if (hits && hits[0]) {
          // Ignore all but closest
          hits[0].facade = facade
          ;(allHits || (allHits = [])).push(hits[0])
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
            const sphere = facade.getBoundingSphere && facade.getBoundingSphere()
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

  _onBgClick(e) {
    // Ignore clicks that bubbled up
    if (e.target === e.currentTarget) {
      this.onBackgroundClick(e)
    }
  }

  destructor() {
    super.destructor()
    this._threeRenderer.dispose()
  }

}



World3DFacade.prototype._notifyWorldHandlers = assign(
  Object.create(WorldBaseFacade.prototype._notifyWorldHandlers),
  {
    getCameraPosition(source, outputVec3) {
      // We decompose from the world matrix here to handle pose transforms on top of the configured position
      outputVec3.setFromMatrixPosition(this.getChildByKey('camera').threeObject.matrixWorld)
    },
    getCameraFacade(source, data) {
      data.callback(this.getChildByKey('camera'))
    },
    getSceneFacade(source, data) {
      data.callback(this.getChildByKey('scene'))
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
    },
    rayPointerMotion(source, ray) {
      // Dispatch a custom event carrying the Ray, which will be used by our `getFacadesAtEvent`
      // override to search for a hovered facade
      const e = new MouseEvent('mousemove')
      e.isRayEvent = true
      e.ray = ray
      e.eventSource = source //for tracking gesture states per ray source
      this._onPointerMotionEvent(e)
    },
    rayPointerAction(source, eventParams) {
      // Dispatch a custom event carrying the Ray, which will be used by our `getFacadesAtEvent`
      // override to search for a hovered facade
      const e = new (eventParams.type === 'wheel' ? WheelEvent : MouseEvent)(eventParams.type, eventParams)
      e.isRayEvent = true
      e.ray = eventParams.ray
      e.eventSource = source //for tracking gesture states per ray source
      this._onPointerActionEvent(e)
    }
  }
)


export default World3DFacade
