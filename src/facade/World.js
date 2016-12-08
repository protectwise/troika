import assign from 'lodash/assign'
import isEmpty from 'lodash/isEmpty'
import map from 'lodash/map'
import {WebGLRenderer, Raycaster, Color, Vector2, Vector3} from 'three'
import Parent from './Parent'
import Scene from './Scene'
import {PerspectiveCamera} from './Camera'
import {POINTER_EVENT_PROPS, POINTER_MOTION_EVENT_PROPS, POINTER_ACTION_EVENT_PROPS} from './Object3D'


const posVec = new Vector3()
const raycaster = new Raycaster()
const pointerActionEventTypesToProps = {
  'click': 'onClick',
  'dblclick': 'onDoubleClick',
  'mousedown': 'onMouseDown',
  'mouseup': 'onMouseUp',
  'touchstart': 'onMouseDown',
  'touchend': 'onMouseUp',
  'touchcancel': 'onMouseUp'
}

function cloneEvent(e) {
  let newEvent = {}
  Object.keys(e.constructor.prototype).forEach(key => {
    newEvent[key] = e[key]
  })
  return newEvent
}

function firePointerEvent(handlerProp, nativeEvent, targetFacade, relatedTargetFacade) {
  let handler = targetFacade[handlerProp]
  if (handler) {
    let newEvent = cloneEvent(nativeEvent)
    newEvent.type = handlerProp.replace(/^on/, '').toLowerCase()
    newEvent.target = newEvent.currentTarget = targetFacade
    newEvent.relatedTarget = relatedTargetFacade || null
    newEvent.nativeEvent = nativeEvent

    // normalize drag events invoked by touch
    if (newEvent.type.indexOf('drag') === 0 && nativeEvent.touches) {
      let touch = nativeEvent.touches[0] || nativeEvent.changedTouches[0]
      if (touch) {
        ;['clientX', 'clientY', 'screenX', 'screenY', 'pageX', 'pageY'].forEach(prop => {
          newEvent[prop] = touch[prop]
        })
      }
    }

    handler(newEvent)
  }
}


class World extends Parent {
  constructor(canvas, threeJsRendererConfig) {
    super(null)

    this.width = this.height = 500
    this._htmlOverlays = Object.create(null)

    this._canvas = canvas
    this._threeRenderer = new WebGLRenderer(assign({
      canvas: canvas,
      alpha: true
    }, threeJsRendererConfig))

    // Bind events
    this._onPointerMotionEvent = this._onPointerMotionEvent.bind(this)
    this._onPointerActionEvent = this._onPointerActionEvent.bind(this)
    this._onDropEvent = this._onDropEvent.bind(this)
    this._togglePointerListeners(true)
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

  _onPointerMotionEvent(e) {
    let registry = this.$eventRegistry
    if (registry && POINTER_MOTION_EVENT_PROPS.some(prop => !!registry[prop])) {
      let dragInfo = this.$dragInfo
      if (dragInfo) {
        if (!dragInfo.dragStartFired) {
          firePointerEvent('onDragStart', dragInfo.dragStartEvent, dragInfo.draggedFacade)
          dragInfo.dragStartFired = true
        }
        firePointerEvent('onDrag', e, dragInfo.draggedFacade)
      }

      let lastHovered = this.$hoveredFacade
      let hovered = this.$hoveredFacade = e.type === 'mouseout' ? null : this._findHoveredFacade(e)
      if (hovered !== lastHovered) {
        if (lastHovered) {
          firePointerEvent('onMouseOut', e, lastHovered, hovered)
          if (dragInfo) {
            firePointerEvent('onDragLeave', e, lastHovered, hovered)
          }
        }
        if (hovered) {
          firePointerEvent('onMouseOver', e, hovered, lastHovered)
          if (dragInfo) {
            firePointerEvent('onDragEnter', e, hovered, lastHovered)
          }
        }
      }
      if (hovered) {
        firePointerEvent('onMouseMove', e, hovered)
        if (dragInfo) {
          firePointerEvent('onDragOver', e, hovered)
        }
      }
    }
  }

  _onPointerActionEvent(e) {
    let registry = this.$eventRegistry
    if (registry && (POINTER_ACTION_EVENT_PROPS.some(prop => !!registry[prop]) || registry.onDragStart)) {
      let facade = this._findHoveredFacade(e)
      if (facade) {
        firePointerEvent(pointerActionEventTypesToProps[e.type], e, facade)

        // mousedown/touchstart could be prepping for drag gesture
        if (facade.onDragStart && (e.type === 'mousedown' || e.type === 'touchstart')) {
          let dragStartEvent = cloneEvent(e)
          this.$dragInfo = {
            draggedFacade: facade,
            dragStartFired: false,
            dragStartEvent: dragStartEvent
          }
          // handle release outside canvas
          this._toggleDropListeners(true)
        }
      }
      e.preventDefault() //prevent e.g. touch scroll
    }
  }

  _onDropEvent(e) {
    let dragInfo = this.$dragInfo
    if (dragInfo) {
      let targetFacade = e.target === this._canvas && this._findHoveredFacade(e)
      if (targetFacade) {
        firePointerEvent('onDrop', e, targetFacade)
      }
      firePointerEvent('onDragEnd', e, dragInfo.draggedFacade)
      this._toggleDropListeners(false)
      this.$dragInfo = null
    }
  }

  _toggleDropListeners(on) {
    ['mouseup', 'touchend', 'touchcancel'].forEach(type => {
      document[(on ? 'add' : 'remove') + 'EventListener'](type, this._onDropEvent, false)
    })
  }

  _togglePointerListeners(on) {
    let canvas = this._canvas
    if (canvas) {
      let method = (on ? 'add' : 'remove') + 'EventListener'
      ;['mousemove', 'mouseout', 'touchmove'].forEach(type => {
        canvas[method](type, this._onPointerMotionEvent, false)
      })
      Object.keys(pointerActionEventTypesToProps).forEach(type => {
        canvas[method](type, this._onPointerActionEvent, false)
      })
    }
  }

  _findHoveredFacade(e) {
    // handle touch events
    let posInfo = e
    if (e.touches) {
      if (e.touches.length > 1) return null //only handle single touches for now
      posInfo = e.touches[0] || e.changedTouches[0]
    }

    // convert mouse position to normalized device coords (-1 to 1)
    let canvasRect = e.target.getBoundingClientRect()
    let coords = new Vector2(
      (posInfo.clientX - canvasRect.left) / canvasRect.width * 2 - 1,
      (posInfo.clientY - canvasRect.top) / canvasRect.height * -2 + 1
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
      let facade = null
      let facadeHasProp = prop => !!facade[prop]
      for (let i = 0; i < allHits.length; i++) {
        facade = allHits[i].facade
        if (facade && facade.pointerEvents !== false && (facade.pointerEvents || POINTER_EVENT_PROPS.some(facadeHasProp))) {
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

    this._togglePointerListeners(false)
    this._toggleDropListeners(false)

    super.destructor()
  }

}



export default World
