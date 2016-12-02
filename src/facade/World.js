import assign from 'lodash/assign'
import clone from 'lodash/clone'
import isEmpty from 'lodash/isEmpty'
import map from 'lodash/map'
import {WebGLRenderer, Raycaster, Color, Vector2, Vector3} from 'three'
import Parent from './Parent'
import Scene from './Scene'
import {PerspectiveCamera} from './Camera'
import {MOUSE_EVENT_PROPS} from './Object3D'


const posVec = new Vector3()
const raycaster = new Raycaster()
const eventTypesToProps = {
  'click': 'onClick',
  'dblclick': 'onDoubleClick',
  'mousedown': 'onMouseDown',
  'mouseup': 'onMouseUp'
}


class World extends Parent {
  constructor(canvas, threeJsRendererConfig) {
    super(null)

    this.width = this.height = 500
    this._htmlOverlays = Object.create(null)

    this._threeRenderer = new WebGLRenderer(assign({
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
    camera.class = camera.class || PerspectiveCamera
    if (typeof camera.aspect !== 'number') {
      camera.aspect = width / height
    }
    scene.key = 'scene'
    scene.class = scene.class || Scene
    this.children = [camera, scene]

    super.afterUpdate()

    let renderer = this._threeRenderer

    let pixelRatio = window.devicePixelRatio
    if (renderer.getPixelRatio() !== pixelRatio) {
      renderer.setPixelRatio(pixelRatio)
    }

    let lastSize = renderer.getSize()
    if (lastSize.width !== width || lastSize.height !== height) {
      renderer.setSize(width, height, true)
    }

    this.queueRender()
  }

  // Requests a ThreeJS render pass on the next animation frame.
  queueRender() {
    if (!this._nextFrameTimer) {
      this._nextFrameTimer = requestAnimationFrame(this._nextFrameHandler || (this._nextFrameHandler = () => {
        this._nextFrameTimer = null
        this._doRender()
      }))
    }
  }

  _doRender() {
    this._threeRenderer.render(this.getChildByKey('scene').threeObject, this.getChildByKey('camera').threeObject)
    this._doRenderHtmlItems()
  }

  _doRenderHtmlItems() {
    if (this.renderHtmlItems) {
      let camera = null
      let htmlItems = map(this._htmlOverlays, (overlay, key) => {
        posVec.setFromMatrixPosition(overlay.threeObject.matrixWorld)
        if (!camera) camera = this.getChildByKey('camera').threeObject
        let distance = posVec.distanceTo(camera.position)
        posVec.project(camera)
        return {
          key: key,
          html: overlay.html,
          x: (posVec.x + 1) * this.width / 2,
          y: (1 - posVec.y) * this.height / 2,
          z: distance
        }
      })
      this.renderHtmlItems(htmlItems)
    }
  }


  onNotifyWorld(source, message, data) {
    switch(message) {
      case 'needsRender':
        this.queueRender()
        break
      case 'getCameraPosition':
        data(this.getChildByKey('camera').threeObject.position) //callback function
        break
      case 'addEventListener':
        let registry = this.$eventRegistry || (this.$eventRegistry = Object.create(null))
        let listeners = registry[data.type] || (registry[data.type] = Object.create(null))
        listeners[source.$facadeId] = data.handler
        break
      case 'removeEventListener':
        listeners = this.$eventRegistry[data.type]
        if (listeners) {
          delete listeners[source.$facadeId]
          if (isEmpty(listeners)) {
            delete this.$eventRegistry[data.type]
          }
        }
        break
      case 'addHtmlOverlay':
        this._htmlOverlays[data.$facadeId] = data
        break
      case 'removeHtmlOverlay':
        delete this._htmlOverlays[data.$facadeId]
        break
    }
  }

  handleMouseMoveEvent(e) {
    let registry = this.$eventRegistry
    if (registry && (registry.onMouseOver || registry.onMouseOut || registry.onMouseMove)) {
      let lastHovered = this.$hoveredFacade
      let hovered = this.$hoveredFacade = e.type === 'mouseout' ? null : this.findHoveredFacade(e)
      if (hovered !== lastHovered) {
        if (lastHovered) {
          let handler = registry.onMouseOut && registry.onMouseOut[lastHovered.$facadeId]
          if (handler) {
            let newEvent = clone(e)
            newEvent.target = newEvent.currentTarget = lastHovered
            newEvent.relatedTarget = hovered || null
            newEvent.originalEvent = e
            handler(newEvent)
          }
        }
        if (hovered) {
          let handler = registry.onMouseOver && registry.onMouseOver[hovered.$facadeId]
          if (handler) {
            let newEvent = clone(e)
            newEvent.target = newEvent.currentTarget = hovered
            newEvent.relatedTarget = lastHovered || null
            newEvent.originalEvent = e
            handler(newEvent)
          }
        }
      }
      if (hovered) {
        let handler = registry.onMouseMove && registry.onMouseMove[hovered.$facadeId]
        if (handler) {
          let newEvent = clone(e)
          newEvent.target = newEvent.currentTarget = hovered
          newEvent.originalEvent = e
          handler(newEvent)
        }
      }
    }
  }

  handleMouseButtonEvent(e) {
    var handler
    let eventProp = eventTypesToProps[e.type]
    let registry = this.$eventRegistry
    if (registry && eventProp && registry[eventProp]) {
      let facade = this.findHoveredFacade(e)
      if (!facade) {
        facade = this.getChildByKey('scene')
        handler = facade[eventProp]
      } else {
        handler = registry[eventProp] && registry[eventProp][facade.$facadeId]
      }
      if (handler) {
        let newEvent = clone(e)
        newEvent.target = newEvent.currentTarget = facade
        newEvent.originalEvent = e
        handler(newEvent)
      }
    }
  }

  findHoveredFacade(e) {
    // convert mouse position to normalized device coords (-1 to 1)
    let canvasRect = e.target.getBoundingClientRect()
    let coords = new Vector2(
      (e.clientX - canvasRect.left) / canvasRect.width * 2 - 1,
      (e.clientY - canvasRect.top) / canvasRect.height * -2 + 1
    )

    // ensure camera's matrix is updated
    let camera = this.getChildByKey('camera').threeObject
    camera.updateMatrixWorld()

    // prep raycaster
    raycaster.setFromCamera(coords, camera)

    // traverse tree to collect hits
    let allHits = null
    this.getChildByKey('scene').traverse(facade => {
      let hits = facade.raycast && facade.raycast(raycaster)
      if (hits && hits[0]) {
        (allHits || (allHits = [])).push({
          facade: facade,
          distance: hits[0].distance //ignore all but closest
        })
      }
    })
    if (allHits) {
      // Sort by distance
      allHits.sort((a, b) => a.distance - b.distance)

      // Find nearest that should intercept mouse events
      // - By default only facades with a mouse event listener assigned will be counted, to prevent being blocked by unwanted objects
      // - If an object should definitely block events from objects behind it, set `pointerEvents:true`
      // - If an object has one of the mouse event properties but should be ignored in raycasting, set `pointerEvents:false`
      for (let i = 0; i < allHits.length; i++) {
        let facade = allHits[i].facade
        if (facade && facade.pointerEvents !== false && (facade.pointerEvents || MOUSE_EVENT_PROPS.some(e => facade[e]))) {
          return facade
        }
      }
    }

    return null
  }

  destructor() {
    if (this._nextFrameTimer) {
      cancelAnimationFrame(this._nextFrameTimer)
    }
    super.destructor()
  }

}



export default World
