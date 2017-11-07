import {assign} from '../../utils'
import {WebGLRenderer, Raycaster, Color, Vector2, Vector3} from 'three'
import WorldBaseFacade from '../WorldBase'
import Scene3DFacade from './Scene3D'
import {PerspectiveCamera3DFacade} from './Camera3D'


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

    // Invoke any onBeforeRender listeners
    let registry = this.$eventRegistry
    let callbacks = registry && registry.onBeforeRender
    if (callbacks) {
      for (let id in callbacks) {
        callbacks[id](this._threeRenderer, scene, camera)
      }
    }

    // Render scene
    this._threeRenderer.render(scene, camera)

    // Invoke any onAfterRender listeners
    callbacks = registry && registry.onAfterRender
    if (callbacks) {
      for (let id in callbacks) {
        callbacks[id](this._threeRenderer, scene, camera)
      }
    }

    let onStatsUpdate = this.onStatsUpdate
    if (onStatsUpdate) {
      let info = this._threeRenderer.info.render
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

    // traverse tree to collect hits
    let allHits = null
    function visit(facade) {
      let hits = facade.raycast && facade.raycast(raycaster)
      if (hits && hits[0]) {
        (allHits || (allHits = [])).push({
          facade: facade,
          distance: hits[0].distance //ignore all but closest
        })
      }
      // recurse to children, unless raycast impl returned false to short-circuit
      if (hits !== false) {
        facade.forEachChild(visit)
      }
    }
    visit(this.getChildByKey('scene'))

    return allHits
  }

  destructor() {
    super.destructor()
    this._threeRenderer.dispose()
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
    }
  }
)


export default World3DFacade
