/**
 * @class EventRegistry
 * Utility for tracking event listeners by type and target facade
 */
export default function EventRegistry() {
  const byEventType = Object.create(null)

  this.addListenerForFacade = (facade, type, handler) => {
    const listenersOfType = byEventType[type] || (byEventType[type] = {
      count: 0,
      byFacadeId: Object.create(null)
    })
    const facadeId = facade.$facadeId
    const oldHandlers = listenersOfType.byFacadeId[facadeId]
    // No listeners for this facade yet; set handler function as single value to avoid
    // unnecessary array creation in the common single-listener case.
    if (!oldHandlers) {
      listenersOfType.count++
      listenersOfType.byFacadeId[facadeId] = handler
    }
    // Already multiple listeners; add to array if not already present
    else if (Array.isArray(oldHandlers)) {
      if (oldHandlers.indexOf(handler) === -1) {
        listenersOfType.count++
        oldHandlers.push(handler)
      }
    }
    // Second unique listener; promote to array
    else if (oldHandlers !== handler) {
      listenersOfType.count++
      listenersOfType.byFacadeId[facadeId] = [oldHandlers, handler]
    }
  }

  this.removeListenerForFacade = (facade, type, handler) => {
    const listenersOfType = byEventType[type]
    const facadeId = facade.$facadeId
    const oldHandlers = listenersOfType && listenersOfType.byFacadeId[facadeId]
    // Single listener; delete from map
    if (oldHandlers === handler) {
      listenersOfType.count--
      delete listenersOfType.byFacadeId[facadeId]
    }
    // Multiple listeners; remove from array
    else if (Array.isArray(oldHandlers)) {
      const idx = oldHandlers.indexOf(handler)
      if (idx > -1) {
        listenersOfType.count--
        // Delete from map if the array will be empty; we don't demote from array to single
        // item because it can result in unneeded churn in the likely case of a different
        // listener being added immediately after
        if (oldHandlers.length === 1) {
          delete listenersOfType.byFacadeId[facadeId]
        } else {
          oldHandlers.splice(idx, 1)
        }
      }
    }
  }

  this.removeAllListenersForFacade = (facade) => {
    const facadeId = facade.$facadeId
    for (let type in byEventType) {
      let facadeListeners = byEventType[type].byFacadeId[facadeId]
      if (facadeListeners) {
        byEventType[type].count -= (Array.isArray(facadeListeners) ? facadeListeners.length : 1)
        delete byEventType[type].byFacadeId[facadeId]
      }
    }
  }

  this.hasFacadeListenersOfType = (facade, type) => {
    return byEventType[type] ? !!byEventType[type].byFacadeId[facade.$facadeId] : false
  }

  this.hasAnyListenersOfType = (type) => {
    return byEventType[type] ? byEventType[type].count > 0 : false
  }

  this.findBubblingEventTarget = (targetFacade, eventType) => {
    while (targetFacade) {
      if (this.hasFacadeListenersOfType(targetFacade, eventType)) {
        return targetFacade
      }
      targetFacade = targetFacade.parent
    }
    return null
  }

  function tryCall(func, scope, arg1, arg2) {
    try {
      func.call(scope, arg1, arg2)
    } catch(err) {
      console.error(err)
    }
  }

  this.forEachFacadeListenerOfType = (facade, type, callback, scope) => {
    const listenersOfType = byEventType[type]
    const facadeId = facade.$facadeId
    const handlers = listenersOfType && listenersOfType.byFacadeId[facadeId]
    if (handlers) {
      if (Array.isArray(handlers)) {
        for (let i = 0; i < handlers.length; i++) {
          tryCall(callback, scope, handlers[i], facadeId)
        }
      } else {
        tryCall(callback, scope, handlers, facadeId)
      }
    }
  }

  this.forEachListenerOfType = (type, callback, scope) => {
    const listenersOfType = byEventType[type]
    if (listenersOfType && listenersOfType.count > 0) {
      for (let facadeId in listenersOfType.byFacadeId) {
        const facadeListeners = listenersOfType.byFacadeId[facadeId]
        if (Array.isArray(facadeListeners)) {
          for (let i = 0; i < facadeListeners.length; i++) {
            tryCall(callback, scope, facadeListeners[i], facadeId)
          }
        } else {
          tryCall(callback, scope, facadeListeners, facadeId)
        }
      }
    }
  }

  this.dispatchEventOnFacade = (facade, event) => {
    let currentTarget = facade
    function callHandler(handler) {
      handler.call(currentTarget, event)
    }
    event.target = facade
    while (currentTarget && !event.propagationStopped) { //TODO should defaultPrevented mean anything here?
      event.currentTarget = currentTarget
      this.forEachFacadeListenerOfType(currentTarget, event.type, callHandler, null)
      if (event.bubbles) {
        currentTarget = currentTarget.parent
      } else {
        break
      }
    }
  }
}

