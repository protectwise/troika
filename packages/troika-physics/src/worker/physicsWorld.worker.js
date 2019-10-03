/* eslint-env worker */
'use strict'

self.physicsEngine = null // Uninitialized engine variable

const PUBLIC_ENGINE_METHODS = [
  'updatePhysicsWorld',
  'add',
  'remove',
  'setActivationState',
  // 'updatePhysicsShape',
  'batchedUpdate'
]

/**
 * Map of physics engine implementations to initializer functions
 * NOTE: initializers must emit a `ready` message when appropriate,
 * and "export" themselves to the `self.physicsEngine` global variable
 *
 * ```
 * self.physicsEngine = new MyEngine()
 * self.postMessage({ type: 'ready' })
 * ```
 */
const AVAILABLE_ENGINES = {
  ammojs: () => {
    importScripts('engines/ammojs/index.js')
  }
  // oimo: () => {
  // TODO add engine for Oimo
  // for simple light rigid bodies: https://github.com/lo-th/Oimo.js
  // }
}

function initPhysicsWorld (engine) {
  if (AVAILABLE_ENGINES[engine]) {
    const initializeEngine = AVAILABLE_ENGINES[engine]
    initializeEngine()
  } else {
    throw new Error(`Invalid Physics Engine specified at init: ${engine}`)
  }
}

self.onmessage = function (message) {
  const msgData = message.data
  const {
    method,
    args = []
  } = msgData

  if (method === 'init') {
    initPhysicsWorld(...args)
    return
  }
  if (method && PUBLIC_ENGINE_METHODS.includes(method)) {
    if (!self.physicsEngine) {
      throw new Error(`Method called before physicsWorld initialized: ${method}`)
    }
    self.physicsEngine[method](...args)
  } else {
    console.log('Unknown method message passed', msgData)
  }
}
