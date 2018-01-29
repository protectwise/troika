/**
 * @class EventRegistry
 * Utility for tracking event listeners by type and target facade
 */
export default function EventRegistry() {
  const byEventType = Object.create(null)

  this.addListenerForFacade = (facade, type, listener) => {
    let listeners = byEventType[type] || (byEventType[type] = {
      count: 0,
      byFacadeId: Object.create(null)
    })
    if (!listeners.byFacadeId[facade.$facadeId]) {
      listeners.count++
    }
    listeners.byFacadeId[facade.$facadeId] = listener
  }

  this.removeListenerForFacade = (facade, type) => {
    let listeners = byEventType[type]
    if (listeners && listeners.byFacadeId[facade.$facadeId]) {
      listeners.count--
      delete listeners.byFacadeId[facade.$facadeId]
    }
  }

  this.removeAllListenersForFacade = (facade) => {
    for (let type in byEventType) {
      this.removeListenerForFacade(facade, type)
    }
  }

  this.hasListenersOfType = (type) => {
    return byEventType[type] ? byEventType[type].count > 0 : false
  }

  this.forEachListenerOfType = (type, callback, scope) => {
    let listeners = byEventType[type]
    if (listeners && listeners.count > 0) {
      for (let id in listeners.byFacadeId) {
        callback.call(scope, listeners.byFacadeId[id], id)
      }
    }
  }
}

