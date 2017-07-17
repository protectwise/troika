import {isObjectEmpty} from '../utils'
import ParentFacade from './Parent'
import {pointerActionEventProps, pointerMotionEventProps} from './PointerEventTarget'

const TAP_DISTANCE_THRESHOLD = 10
const TAP_GESTURE_MAX_DUR = 300

const pointerActionEventTypesToProps = {
  'click': 'onClick',
  'dblclick': 'onDoubleClick',
  'mousedown': 'onMouseDown',
  'mouseup': 'onMouseUp',
  'touchstart': 'onMouseDown',
  'touchend': 'onMouseUp',
  'touchcancel': 'onMouseUp'
}

const touchDragPropsToNormalize = ['clientX', 'clientY', 'screenX', 'screenY', 'pageX', 'pageY']

class SyntheticEvent {
  constructor(nativeEvent, type, target, relatedTarget) {
    // Copy native event properties - TODO investigate using a Proxy
    Object.keys(nativeEvent.constructor.prototype).forEach(key => {
      if (typeof nativeEvent[key] !== 'function') {
        this[key] = nativeEvent[key]
      }
    })

    // Adjust to custom params
    this.target = target
    this.relatedTarget = relatedTarget
    this.type = type
    this.nativeEvent = nativeEvent

    // normalize position properties on touch events with a single touch, to facilitate
    // downstream handlers that expect them to look like mouse events
    if (nativeEvent.touches) {
      let touches = isTouchEndOrCancel(nativeEvent) ? nativeEvent.changedTouches : nativeEvent.touches
      if (touches.length === 1) {
        touchDragPropsToNormalize.forEach(prop => {
          this[prop] = touches[0][prop]
        })
      }
    }
  }

  preventDefault() {
    this.defaultPrevented = true
    this.nativeEvent.preventDefault()
  }

  stopPropagation() {
    this.propagationStopped = true
    this.nativeEvent.stopPropagation()
  }
}

function firePointerEvent(handlerProp, nativeEvent, targetFacade, relatedTargetFacade) {
  let newEvent = new SyntheticEvent(
    nativeEvent,
    handlerProp.replace(/^on/, '').toLowerCase(),
    targetFacade,
    relatedTargetFacade
  )
  // Dispatch with bubbling
  // TODO genericize bubbling for future non-pointer-related events
  let currentTarget = targetFacade
  while (currentTarget && !newEvent.propagationStopped) { //TODO should defaultPrevented mean anything here?
    let handler = currentTarget[handlerProp]
    if (handler) {
      newEvent.currentTarget = currentTarget
      handler.call(currentTarget, newEvent)
    }
    currentTarget = currentTarget.parent
  }
}

function hasEventHandlerInParentTree(targetFacade, eventProp) {
  while (targetFacade) {
    if (targetFacade[eventProp]) {
      return true
    }
    targetFacade = targetFacade.parent
  }
  return false
}

function isTouchEndOrCancel(e) {
  return e.type === 'touchend' || e.type === 'touchcancel'
}

function killEvent(e) {
  e.stopPropagation()
  e.preventDefault()
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
    let handler = this._notifyWorldHandlers[message]
    if (handler) {
      handler.call(this, source, data)
    }
  }

  _addEventListener(source, type, handler) {
    let registry = this.$eventRegistry
    let listeners = registry[type] || (registry[type] = Object.create(null))
    listeners[source.$facadeId] = handler
  }

  _removeEventListener(source, type) {
    let listeners = this.$eventRegistry[type]
    if (listeners) {
      delete listeners[source.$facadeId]
    }
  }

  _removeAllEventListeners(source) {
    let registry = this.$eventRegistry
    for (let type in registry) {
      let listeners = registry[type]
      delete listeners[source.$facadeId]
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
        data.exact = facade.exact
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
      let hovered = this.$hoveredFacade = (e.type === 'mouseout' || isTouchEndOrCancel(e)) ? null : this._findHoveredFacade(e)
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
    // Map touch start to mouseover, and disable touch-hold context menu
    if (e.type === 'touchstart') {
      if (e.touches.length === 1) {
        this._onPointerMotionEvent(e)
      }
      this._enableContextMenu(false)
    }

    if (this._hasEventListenersOfType('onDragStart') || pointerActionEventProps.some(this._hasEventListenersOfType.bind(this))) {
      let facade = this._findHoveredFacade(e)
      if (facade) {
        firePointerEvent(pointerActionEventTypesToProps[e.type], e, facade)

        // touchstart/touchend could be start/end of a tap - map to onClick
        if (hasEventHandlerInParentTree(facade, 'onClick')) {
          if (e.type === 'touchstart' && e.touches.length === 1) {
            this.$tapInfo = {
              facade: facade,
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
              startTime: Date.now()
            }
          }
          else {
            let tapInfo = this.$tapInfo
            if (
              tapInfo && tapInfo.facade === facade && e.type === 'touchend' &&
              e.touches.length === 0 && e.changedTouches.length === 1 &&
              Date.now() - tapInfo.startTime < TAP_GESTURE_MAX_DUR
            ) {
              firePointerEvent('onClick', e, facade)
            }
            this.$tapInfo = null
          }
        }

        // mousedown/touchstart could be prepping for drag gesture
        if (facade.onDragStart && (e.type === 'mousedown' || e.type === 'touchstart')) {
          let dragStartEvent = new SyntheticEvent(e, 'dragstart', facade, null)
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

    // Map touch end to mouseout
    if (isTouchEndOrCancel(e)) {
      if (e.changedTouches.length === 1) {
        this._onPointerMotionEvent(e)
      }
      this._enableContextMenu(true)
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

  _enableContextMenu(enable) {
    let canvas = this._element
    if (canvas) {
      canvas[(enable ? 'remove' : 'add') + 'EventListener']('contextmenu', killEvent, true)
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


WorldBaseFacade.prototype._notifyWorldHandlers = {
  needsRender() {
    this._queueRender()
  },
  addEventListener(source, data) {
    this._addEventListener(source, data.type, data.handler)
  },
  removeEventListener(source, data) {
    this._removeEventListener(source, data.type)
  },
  removeAllEventListeners(source) {
    this._removeAllEventListeners(source)
  },
  addHtmlOverlay(source) {
    this._htmlOverlays[source.$facadeId] = source
  },
  removeHtmlOverlay(source) {
    delete this._htmlOverlays[source.$facadeId]
  }
}



export default WorldBaseFacade
