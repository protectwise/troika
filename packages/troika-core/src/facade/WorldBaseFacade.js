import ParentFacade from './ParentFacade'
import EventRegistry from './EventRegistry'
import {pointerActionEventTypes, pointerMotionEventTypes} from './PointerEventTarget'
import {assign} from '../utils'

const TAP_DISTANCE_THRESHOLD = 10
const TAP_GESTURE_MAX_DUR = 300
const TAP_DBLCLICK_MAX_DUR = 300

const domPointerMotionEventTypes = [
  'mousemove',
  'mouseout',
  'touchmove'
]
const domPointerActionEventTypes = [
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'wheel',
  'touchstart',
  'touchend',
  'touchcancel'
]
const dropEventTypes = [
  'mouseup',
  'touchend',
  'touchcancel'
]
const pointerActionEventTypeMappings = {
  'touchstart': 'mousedown',
  'touchend': 'mouseup',
  'touchcancel': 'mouseup'
}

const touchDragPropsToNormalize = ['clientX', 'clientY', 'screenX', 'screenY', 'pageX', 'pageY']

class SyntheticEvent {
  constructor(nativeEvent, type, target, relatedTarget, extraProps) {
    // Copy native event properties - TODO investigate using a Proxy
    for (let prop in nativeEvent) {
      // NOTE: we don't check hasOwnProperty in this loop because properties that will return
      // false for properties that are defined by getters on inherited prototypes
      if (typeof nativeEvent[prop] !== 'function') {
        this[prop] = nativeEvent[prop]
      }
    }

    // Adjust to custom params
    this.target = target
    this.relatedTarget = relatedTarget
    this.type = type
    this.nativeEvent = nativeEvent
    assign(this, extraProps)

    // normalize position properties on touch events with a single touch, to facilitate
    // downstream handlers that expect them to look like mouse events
    // NOTE: can't do this in _normalizePointerEvent() as these props are unwritable on native Event objects
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
      this._nextFrameTimer = this._requestRenderFrame(this._nextFrameHandler || (this._nextFrameHandler = (...args) => {
        let {onStatsUpdate, onBeforeRender, onAfterRender} = this
        let start = onStatsUpdate && Date.now()

        if (onBeforeRender) onBeforeRender(this)

        this.doRender(...args)

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

  /**
   * Hook allowing world implementations to pre-normalize native pointer events, for instance
   * computing derived worldspace properties that are simpler for downstream code to use.
   * @param {Event} e
   * @protected
   */
  _normalizePointerEvent(e) {
  }

  /**
   * Entry point for handling events related to pointer motion (e.g. mouse or touch movement).
   * This will be called by the code that wraps this World facade to bridge native DOM events
   * into the Troika world.
   * @param {Event} e
   */
  _onPointerMotionEvent(e) {
    this._normalizePointerEvent(e)

    if (pointerMotionEventTypes.some(this.eventRegistry.hasAnyListenersOfType)) {
      let hoverInfo = (e.type === 'mouseout' || isTouchEndOrCancel(e)) ? null : this._findHoverTarget(e)
      let lastHovered = this.$hoveredFacade
      let hovered = this.$hoveredFacade = hoverInfo && hoverInfo.facade

      let dragInfo = this.$dragInfo
      if (dragInfo) {
        if (!dragInfo.dragStartFired) {
          this._firePointerEvent('dragstart', dragInfo.dragStartEvent, dragInfo.draggedFacade, null, hoverInfo)
          dragInfo.dragStartFired = true
        }
        this._firePointerEvent('drag', e, dragInfo.draggedFacade, null, hoverInfo)
      }

      if (hovered !== lastHovered) {
        if (lastHovered) {
          this._firePointerEvent('mouseout', e, lastHovered, hovered, hoverInfo)
          if (dragInfo) {
            this._firePointerEvent('dragleave', e, lastHovered, hovered, hoverInfo)
          }
        }
        if (hovered) {
          this._firePointerEvent('mouseover', e, hovered, lastHovered, hoverInfo)
          if (dragInfo) {
            this._firePointerEvent('dragenter', e, hovered, lastHovered, hoverInfo)
          }
        }
      }
      if (hovered) {
        this._firePointerEvent('mousemove', e, hovered, null, hoverInfo)
        if (dragInfo) {
          this._firePointerEvent('dragover', e, hovered, null, hoverInfo)
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

  /**
   * Entry point for handling events related to pointer motion (e.g. mouse clicks or touch taps).
   * This will be called by the code that wraps this World facade to bridge native DOM events
   * into the Troika world.
   * @param {Event} e
   */
  _onPointerActionEvent(e) {
    this._normalizePointerEvent(e)

    // Handle drop events, in the case they weren't captured by the listeners on `document`
    // e.g. synthetic events dispatched internally
    if (dropEventTypes.indexOf(e.type) > -1) {
      this._onDropEvent(e)
    }

    // Map touch start to mouseover, and disable touch-hold context menu
    if (e.type === 'touchstart') {
      if (e.touches.length === 1) {
        this._onPointerMotionEvent(e)
      }
      this._enableContextMenu(false)
    }

    const eventRegistry = this.eventRegistry
    if (eventRegistry.hasAnyListenersOfType('dragstart') || pointerActionEventTypes.some(eventRegistry.hasAnyListenersOfType)) {
      let hoverInfo = this._findHoverTarget(e)
      let facade = hoverInfo && hoverInfo.facade
      if (facade) {
        this._firePointerEvent(pointerActionEventTypeMappings[e.type] || e.type, e, facade, null, hoverInfo)

        // touchstart/touchend could be start/end of a tap - map to click
        if (this._hasEventHandlerInParentTree(facade, 'click') || this._hasEventHandlerInParentTree(facade, 'dblclick')) {
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
              this._firePointerEvent('click', e, facade, null, hoverInfo)
              if (tapInfo.isDblClick) {
                this._firePointerEvent('dblclick', e, facade, null, hoverInfo)
              }
            }
          }
        }

        // mousedown/touchstart could be prepping for drag gesture
        if (facade.onDragStart && (e.type === 'mousedown' || e.type === 'touchstart')) {
          let dragStartEvent = new SyntheticEvent(e, 'dragstart', facade, null, {intersection: hoverInfo})
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
      this._normalizePointerEvent(e)
      let hoverInfo = this._findHoverTarget(e)
      let targetFacade = hoverInfo && hoverInfo.facade
      if (targetFacade) {
        this._firePointerEvent('drop', e, targetFacade, null, hoverInfo)
      }
      this._firePointerEvent('dragend', e, dragInfo.draggedFacade, null, hoverInfo)
      this._toggleDropListeners(false)
      this.$dragInfo = null
    }
  }

  _firePointerEvent(eventType, originalEvent, targetFacade, relatedTargetFacade, intersection) {
    let newEvent = (originalEvent instanceof SyntheticEvent) ?
      originalEvent :
      new SyntheticEvent(
        originalEvent,
        eventType,
        targetFacade,
        relatedTargetFacade,
        {intersection}
      )
    // Dispatch with bubbling
    // TODO genericize bubbling for future non-pointer-related events
    let currentTarget = targetFacade
    function callHandler(handler) {
      handler.call(currentTarget, newEvent)
    }
    while (currentTarget && !newEvent.propagationStopped) { //TODO should defaultPrevented mean anything here?
      newEvent.currentTarget = currentTarget
      this.eventRegistry.forEachFacadeListenerOfType(currentTarget, eventType, callHandler, null)
      currentTarget = currentTarget.parent
    }
  }

  _hasEventHandlerInParentTree(targetFacade, eventType) {
    while (targetFacade) {
      if (this.eventRegistry.hasFacadeListenersOfType(eventType)) {
        return true
      }
      targetFacade = targetFacade.parent
    }
    return false
  }

  _toggleDropListeners(on) {
    dropEventTypes.forEach(type => {
      document[(on ? 'add' : 'remove') + 'EventListener'](type, this._onDropEvent, true)
    })
  }

  _togglePointerListeners(on) {
    let canvas = this._element
    if (canvas && on !== this._pointerListenersAttached) {
      let method = (on ? 'add' : 'remove') + 'EventListener'
      domPointerMotionEventTypes.forEach(type => {
        canvas[method](type, this._onPointerMotionEvent, false)
      })
      domPointerActionEventTypes.forEach(type => {
        canvas[method](type, this._onPointerActionEvent, false)
      })
      this._pointerListenersAttached = on
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
   * Given a pointer-related Event, find and return all facade objects that are intersected
   * by that event. If any hits are found, this should return an array of objects that contain
   * at least `facade` and `distance` properties. Any additional properties will be exposed to
   * event listeners on the synthetic event object as an `intersection` property.
   * @param {Event} e
   * @param {Function} [filterFn]
   * @return {Array<{facade, distance, ?distanceBias, ...}>|null}
   */
  getFacadesAtEvent(e, filterFn) {
    throw new Error('getFacadesAtEvent: no impl')
  }

  _findHoverTarget(e) {
    //only handle single touches for now
    if (e.touches && e.touches.length > 1) {
      return null
    }

    let allHits = this.getFacadesAtEvent(e, facade =>
      facade.isPointerEventTarget && facade.interceptsPointerEvents(this.eventRegistry)
    )
    if (allHits) {
      // Find the closest by comparing distance, or distanceBias if distance is the same
      let closestHit = allHits[0]
      for (let i = 1; i < allHits.length; i++) {
        if (allHits[i].distance < closestHit.distance ||
          (allHits[i].distance === closestHit.distance && (allHits[i].distanceBias || 0) < (closestHit.distanceBias || 0))
        ) {
          closestHit = allHits[i]
        }
      }
      return closestHit
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
    this.eventRegistry.removeListenerForFacade(source, data.type, data.handler)
  },
  removeAllEventListeners(source) {
    this.eventRegistry.removeAllListenersForFacade(source)
  },
  dispatchEvent(source, data) {
    this.eventRegistry.forEachFacadeListenerOfType(data.targetFacade, data.type, data.handler, null)
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
