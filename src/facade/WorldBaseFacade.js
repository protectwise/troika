import ParentFacade from './ParentFacade'
import EventRegistry from './EventRegistry'
import {pointerActionEventProps, pointerMotionEventProps} from './PointerEventTarget'

const TAP_DISTANCE_THRESHOLD = 10
const TAP_GESTURE_MAX_DUR = 300
const TAP_DBLCLICK_MAX_DUR = 300

const pointerActionEventTypesToProps = {
  'click': 'onClick',
  'dblclick': 'onDoubleClick',
  'mousedown': 'onMouseDown',
  'mouseup': 'onMouseUp',
  'wheel': 'onWheel',
  'touchstart': 'onMouseDown',
  'touchend': 'onMouseUp',
  'touchcancel': 'onMouseUp'
}

const touchDragPropsToNormalize = ['clientX', 'clientY', 'screenX', 'screenY', 'pageX', 'pageY']

class SyntheticEvent {
  constructor(nativeEvent, type, target, relatedTarget, extra) {
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
    this.extra = extra

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

function firePointerEvent(handlerProp, nativeEvent, targetFacade, relatedTargetFacade, extra) {
  let newEvent = new SyntheticEvent(
    nativeEvent,
    handlerProp.replace(/^on/, '').toLowerCase(),
    targetFacade,
    relatedTargetFacade,
    extra
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
    this.eventRegistry = new EventRegistry()
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

  _isContinuousRender() {
    return this.continuousRender
  }

  /**
   * @protected Schedule a callback for the next renderable frame. Defaults to browser's
   * `requestAnimationFrame` but can be overridden to use different timing strategies such
   * as WebVR's device frame rate scheduler.
   */
  _requestRenderFrame(callback) {
    return window.requestAnimationFrame(callback)
  }

  /**
   * @protected Cancel a scheduled callback for the next renderable frame. Defaults to browser's
   * `cancelAnimationFrame` but can be overridden to use different timing strategies such
   * as WebVR's device frame rate scheduler.
   */
  _cancelAnimationFrame(frameId) {
    return window.cancelAnimationFrame(frameId)
  }

  // Schedule a render pass on the next frame
  _queueRender() {
    if (!this._nextFrameTimer) {
      this._nextFrameTimer = this._requestRenderFrame(this._nextFrameHandler || (this._nextFrameHandler = () => {
        let {onStatsUpdate, onBeforeRender, onAfterRender} = this
        let start = onStatsUpdate && Date.now()

        if (onBeforeRender) onBeforeRender(this)

        this.doRender()

        if (onStatsUpdate) {
          let now = Date.now()
          onStatsUpdate({
            'Render CPU Time (ms)': now - start,
            'Time Between Frames (ms)': this._lastFrameTime ? now - this._lastFrameTime : '?',
            'FPS': this._lastFrameTime ? Math.round(1000 / (now - this._lastFrameTime)) : '?'
          })
          this._lastFrameTime = now
        }

        this._doRenderHtmlItems()

        if (onAfterRender) onAfterRender(this)

        this._nextFrameTimer = null

        if (this._isContinuousRender()) {
          this._queueRender()
        }
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
        if (data.z >= 0) { //Ignore objects with negative z (behind the camera)
          data.key = facade.$facadeId
          data.html = facade.html
          data.exact = facade.exact
          htmlItemsData.push(data)
        }
      }
      this.renderHtmlItems(htmlItemsData)
    }
  }

  _onPointerMotionEvent(e) {
    if (pointerMotionEventProps.some(this.eventRegistry.hasListenersOfType)) {
      let dragInfo = this.$dragInfo
      if (dragInfo) {
        if (!dragInfo.dragStartFired) {
          let handler = dragInfo.draggedFacade.onDragStart
          if (handler) handler(dragInfo.dragStartEvent)
          dragInfo.dragStartFired = true
        }
        firePointerEvent('onDrag', e, dragInfo.draggedFacade, null, null)
      }

      let lastHovered = this.$hoveredFacade
      let hoverInfo = (e.type === 'mouseout' || isTouchEndOrCancel(e)) ? null : this._findHoverTarget(e)
      let hovered = this.$hoveredFacade = hoverInfo && hoverInfo.facade
      if (hovered !== lastHovered) {
        if (lastHovered) {
          firePointerEvent('onMouseOut', e, lastHovered, hovered, hoverInfo)
          if (dragInfo) {
            firePointerEvent('onDragLeave', e, lastHovered, hovered, hoverInfo)
          }
        }
        if (hovered) {
          firePointerEvent('onMouseOver', e, hovered, lastHovered, hoverInfo)
          if (dragInfo) {
            firePointerEvent('onDragEnter', e, hovered, lastHovered, hoverInfo)
          }
        }
      }
      if (hovered) {
        firePointerEvent('onMouseMove', e, hovered, null, hoverInfo)
        if (dragInfo) {
          firePointerEvent('onDragOver', e, hovered, null, hoverInfo)
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

    if (this.eventRegistry.hasListenersOfType('onDragStart') || pointerActionEventProps.some(this.eventRegistry.hasListenersOfType)) {
      let hoverInfo = this._findHoverTarget(e)
      let facade = hoverInfo && hoverInfo.facade
      if (facade) {
        firePointerEvent(pointerActionEventTypesToProps[e.type], e, facade, null, hoverInfo)

        // touchstart/touchend could be start/end of a tap - map to onClick
        if (hasEventHandlerInParentTree(facade, 'onClick') || hasEventHandlerInParentTree(facade, 'onDoubleClick')) {
          let tapInfo = this.$tapInfo
          if (e.type === 'touchstart' && e.touches.length === 1) {
            this.$tapInfo = {
              facade: facade,
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
              startTime: Date.now(),
              isDblClick: tapInfo && Date.now() - tapInfo.startTime < TAP_DBLCLICK_MAX_DUR
            }
          } else {
            if (
              tapInfo && tapInfo.facade === facade && e.type === 'touchend' &&
              e.touches.length === 0 && e.changedTouches.length === 1 &&
              Date.now() - tapInfo.startTime < TAP_GESTURE_MAX_DUR
            ) {
              firePointerEvent('onClick', e, facade, null, hoverInfo)
              if (tapInfo.isDblClick) {
                firePointerEvent('onDoubleClick', e, facade, null, hoverInfo)
              }
            }
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
      let hoverInfo = e.target === this._element && this._findHoverTarget(e)
      let targetFacade = hoverInfo && hoverInfo.facade
      if (targetFacade) {
        firePointerEvent('onDrop', e, targetFacade, null, hoverInfo)
      }
      firePointerEvent('onDragEnd', e, dragInfo.draggedFacade, null, hoverInfo)
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

  /**
   * @protected
   */
  getFacadesAtEvent(e) {
    // handle touch events
    let posInfo = e
    if (e.touches) {
      if (e.touches.length > 1) return null //only handle single touches for now
      posInfo = e.touches[0] || e.changedTouches[0]
    }
    return this.getFacadesAtPosition(posInfo.clientX, posInfo.clientY, e.target.getBoundingClientRect())
  }

  _findHoverTarget(e) {
    let allHits = this.getFacadesAtEvent(e)
    if (allHits) {
      // Sort by distance, or by distanceBias if distance is the same
      allHits.sort((a, b) => (a.distance - b.distance) || ((a.distanceBias || 0) - (b.distanceBias || 0)))

      // Find nearest that should intercept mouse events
      for (let i = 0; i < allHits.length; i++) {
        let facade = allHits[i].facade
        if (facade.isPointerEventTarget && facade.interceptsPointerEvents()) {
          return allHits[i]
        }
      }
    }

    return null
  }

  destructor() {
    if (this._nextFrameTimer) {
      this._cancelAnimationFrame(this._nextFrameTimer)
    }
    this._togglePointerListeners(false)
    this._toggleDropListeners(false)
    super.destructor()
  }

}

Object.defineProperty(WorldBaseFacade.prototype, 'isWorld', {value: true})

WorldBaseFacade.prototype._notifyWorldHandlers = {
  needsRender() {
    this._queueRender()
  },
  addEventListener(source, data) {
    this.eventRegistry.addListenerForFacade(source, data.type, data.handler)
  },
  removeEventListener(source, data) {
    this.eventRegistry.removeListenerForFacade(source, data.type)
  },
  removeAllEventListeners(source) {
    this.eventRegistry.removeAllListenersForFacade(source)
  },
  addHtmlOverlay(source) {
    this._htmlOverlays[source.$facadeId] = source
  },
  removeHtmlOverlay(source) {
    delete this._htmlOverlays[source.$facadeId]
  },
  statsUpdate(source, data) {
    let onStatsUpdate = this.onStatsUpdate
    if (onStatsUpdate) onStatsUpdate(data)
  }
}



export default WorldBaseFacade
