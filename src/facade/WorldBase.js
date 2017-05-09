import {isObjectEmpty} from '../utils'
import ParentFacade from './Parent'
import {pointerActionEventProps, pointerMotionEventProps} from './PointerEventTarget'

const TAP_DISTANCE_THRESHOLD = 10

const pointerActionEventTypesToProps = {
  'click': 'onClick',
  'dblclick': 'onDoubleClick',
  'mousedown': 'onMouseDown',
  'mouseup': 'onMouseUp',
  'touchstart': 'onMouseDown',
  'touchend': 'onMouseUp',
  'touchcancel': 'onMouseUp'
}

function createSyntheticEvent(nativeEvent, type, targetFacade, relatedTargetFacade) {
  let newEvent = {}
  Object.keys(nativeEvent.constructor.prototype).forEach(key => {
    newEvent[key] = nativeEvent[key]
  })
  newEvent.type = type
  newEvent.target = newEvent.currentTarget = targetFacade
  newEvent.relatedTarget = relatedTargetFacade || null
  newEvent.nativeEvent = nativeEvent

  // normalize drag events invoked by touch
  if (type.indexOf('drag') === 0 && nativeEvent.touches) {
    let touch = nativeEvent.touches[0] || nativeEvent.changedTouches[0]
    if (touch) {
      ;['clientX', 'clientY', 'screenX', 'screenY', 'pageX', 'pageY'].forEach(prop => {
        newEvent[prop] = touch[prop]
      })
    }
  }

  return newEvent
}

function firePointerEvent(handlerProp, nativeEvent, targetFacade, relatedTargetFacade) {
  let handler = targetFacade[handlerProp]
  if (handler) {
    let newEvent = createSyntheticEvent(
      nativeEvent,
      handlerProp.replace(/^on/, '').toLowerCase(),
      targetFacade,
      relatedTargetFacade
    )
    handler(newEvent)
  }
}


class WorldBaseFacade extends ParentFacade {
  constructor(element) {
    super(null)

    this.width = this.height = 1
    this._element = element
    this._htmlOverlays = Object.create(null)

    // Bind events
    this.$eventRegistry = Object.create(null)
    this._onPointerMotionEvent = this._onPointerMotionEvent.bind(this)
    this._onPointerActionEvent = this._onPointerActionEvent.bind(this)
    this._onDropEvent = this._onDropEvent.bind(this)
    this._togglePointerListeners(true)
  }

  afterUpdate() {
    this._queueRender()
    super.afterUpdate()
  }

  onNotifyWorld(source, message, data) {
    let listeners, registry
    switch(message) {
      case 'needsRender':
        this._queueRender()
        break
      case 'addEventListener':
        registry = this.$eventRegistry
        listeners = registry[data.type] || (registry[data.type] = Object.create(null))
        listeners[source.$facadeId] = data.handler
        break
      case 'removeEventListener':
        listeners = this.$eventRegistry[data.type]
        if (listeners) {
          delete listeners[source.$facadeId]
        }
        break
      case 'removeAllEventListeners':
        registry = this.$eventRegistry
        for (let type in registry) {
          let listeners = registry[type]
          delete listeners[source.$facadeId]
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

  // Schedule a render pass on the next frame
  _queueRender() {
    if (!this._nextFrameTimer) {
      this._nextFrameTimer = requestAnimationFrame(this._nextFrameHandler || (this._nextFrameHandler = () => {
        this._nextFrameTimer = null
        this.doRender()
        this._doRenderHtmlItems()
      }))
    }
  }

  /**
   * @abstract
   */
  doRender() {
  }

  /**
   * @abstract
   */
  getFacadeUserSpaceXYZ(facade) {
  }

  _doRenderHtmlItems() {
    if (this.renderHtmlItems) {
      let htmlItemsData = []
      let overlayFacades = this._htmlOverlays
      for (let key in overlayFacades) {
        let facade = overlayFacades[key]
        let data = this.getFacadeUserSpaceXYZ(facade)
        data.key = facade.$facadeId
        data.html = facade.html
        htmlItemsData.push(data)
      }
      this.renderHtmlItems(htmlItemsData)
    }
  }

  _hasEventListenersOfType(type) {
    let listeners = this.$eventRegistry[type]
    return listeners ? !isObjectEmpty(listeners) : false
  }

  _onPointerMotionEvent(e) {
    if (pointerMotionEventProps.some(this._hasEventListenersOfType.bind(this))) {
      let dragInfo = this.$dragInfo
      if (dragInfo) {
        if (!dragInfo.dragStartFired) {
          let handler = dragInfo.draggedFacade.onDragStart
          if (handler) handler(dragInfo.dragStartEvent)
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

    // Cancel tap gesture if moving past threshold
    let tapInfo = this.$tapInfo
    if (tapInfo && e.type === 'touchmove') {
      let touch = e.changedTouches[0]
      if (touch && Math.sqrt(Math.pow(touch.clientX - tapInfo.x, 2) + Math.pow(touch.clientY - tapInfo.y, 2)) > TAP_DISTANCE_THRESHOLD) {
        this.$tapInfo = null
      }
    }
  }

  _onPointerActionEvent(e) {
    if (this._hasEventListenersOfType('onDragStart') || pointerActionEventProps.some(this._hasEventListenersOfType.bind(this))) {
      let facade = this._findHoveredFacade(e)
      if (facade) {
        firePointerEvent(pointerActionEventTypesToProps[e.type], e, facade)

        // touchstart/touchend could be start/end of a tap - map to onClick
        if (facade.onClick) {
          if (e.type === 'touchstart' && e.touches.length === 1) {
            this.$tapInfo = {x: e.touches[0].clientX, y: e.touches[0].clientY, facade: facade}
          }
          else {
            let tapInfo = this.$tapInfo
            if (tapInfo && tapInfo.facade === facade && e.type === 'touchend' &&
                e.touches.length === 0 && e.changedTouches.length === 1) {
              firePointerEvent('onClick', e, facade)
            }
            this.$tapInfo = null
          }
        }

        // mousedown/touchstart could be prepping for drag gesture
        if (facade.onDragStart && (e.type === 'mousedown' || e.type === 'touchstart')) {
          let dragStartEvent = createSyntheticEvent(e, 'dragstart', facade, null)
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
      let targetFacade = e.target === this._element && this._findHoveredFacade(e)
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
      document[(on ? 'add' : 'remove') + 'EventListener'](type, this._onDropEvent, true)
    })
  }

  _togglePointerListeners(on) {
    let canvas = this._element
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

  /**
   * @abstract
   */
  getFacadesAtPosition(clientX, clientY, elementRect) {
    throw new Error('getFacadesAtEvent: no impl')
  }

  _findHoveredFacade(e) {
    // handle touch events
    let posInfo = e
    if (e.touches) {
      if (e.touches.length > 1) return null //only handle single touches for now
      posInfo = e.touches[0] || e.changedTouches[0]
    }

    let allHits = this.getFacadesAtPosition(posInfo.clientX, posInfo.clientY, e.target.getBoundingClientRect())
    if (allHits) {
      // Sort by distance
      allHits.sort((a, b) => a.distance - b.distance)

      // Find nearest that should intercept mouse events
      for (let i = 0; i < allHits.length; i++) {
        let facade = allHits[i].facade
        if (facade.isPointerEventTarget && facade.interceptsPointerEvents()) {
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



export default WorldBaseFacade
