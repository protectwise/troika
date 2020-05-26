import Thenable from './Thenable.js'
import { workerBootstrap } from './workerBootstrap.js'
import { defineMainThreadModule } from './mainThreadFallback.js'
import { supportsWorkers } from './supportsWorkers.js'

let _workerModuleId = 0
let _messageId = 0
let _allowInitAsString = false
const workers = Object.create(null)
const openRequests = Object.create(null)
openRequests._count = 0


/**
 * Define a module of code that will be executed with a web worker. This provides a simple
 * interface for moving chunks of logic off the main thread, and managing their dependencies
 * among one another.
 *
 * @param {object} options
 * @param {function} options.init - The main function that initializes the module. This will be run
 *        within the worker, and will be passed the resolved dependencies as arguments. Its
 *        return value becomes the module's content, which can then be used by other modules
 *        that depend on it. This function can perform any logic using those dependencies, but
 *        must not depend on anything from its parent closures.
 * @param {array} [options.dependencies] - Provides any dependencies required by the init function:
 *        - Primitives like strings, numbers, booleans
 *        - Raw functions; these will be stringified and rehydrated within the worker so they
 *          must not depend on anything from their parent closures
 *        - Other worker modules; these will be resolved within the worker, and therefore modules
 *          that provide functions can be called without having to cross the worker/main thread
 *          boundary.
 * @param {function} [options.getTransferables] - An optional function that will be run in the worker
 *        just before posting the response value from a module call back to the main thread.
 *        It will be passed that response value, and if it returns an array then that will be
 *        used as the "transferables" parameter to `postMessage`. Use this if there are values
 *        in the response that can/should be transfered rather than cloned.
 * @param {string} [options.name] - A descriptive name for this module; this can be useful for
 *        debugging but is not currently used for anything else.
 * @param {string} [options.workerId] - By default all modules will run in the same dedicated worker,
 *        but if you want to use multiple workers you can pass a `workerId` to indicate a specific
 *        worker to spawn. Note that each worker is completely standalone and no data or state will
 *        be shared between them. If a worker module is used as a dependency by worker modules
 *        using different `workerId`s, then that dependency will be re-registered in each worker.
 * @return {function(...[*]): {then}}
 */
export function defineWorkerModule(options) {
  if ((!options || typeof options.init !== 'function') && !_allowInitAsString) {
    throw new Error('requires `options.init` function')
  }
  let {dependencies, init, getTransferables, workerId} = options

  if (!supportsWorkers()) {
    return defineMainThreadModule(options)
  }

  if (workerId == null) {
    workerId = '#default'
  }
  const id = `workerModule${++_workerModuleId}`
  const name = options.name || id
  let registrationThenable = null

  dependencies = dependencies && dependencies.map(dep => {
    // Wrap raw functions as worker modules with no dependencies
    if (typeof dep === 'function' && !dep.workerModuleData) {
      _allowInitAsString = true
      dep = defineWorkerModule({
        workerId,
        name: `<${name}> function dependency: ${dep.name}`,
        init: `function(){return (\n${stringifyFunction(dep)}\n)}`
      })
      _allowInitAsString = false
    }
    // Grab postable data for worker modules
    if (dep && dep.workerModuleData) {
      dep = dep.workerModuleData
    }
    return dep
  })

  function moduleFunc(...args) {
    // Register this module if needed
    if (!registrationThenable) {
      registrationThenable = callWorker(workerId,'registerModule', moduleFunc.workerModuleData)
    }

    // Invoke the module, returning a thenable
    return registrationThenable.then(({isCallable}) => {
      if (isCallable) {
        return callWorker(workerId,'callModule', {id, args})
      } else {
        throw new Error('Worker module function was called but `init` did not return a callable function')
      }
    })
  }
  moduleFunc.workerModuleData = {
    isWorkerModule: true,
    id,
    name,
    dependencies,
    init: stringifyFunction(init),
    getTransferables: getTransferables && stringifyFunction(getTransferables)
  }
  return moduleFunc
}

/**
 * Stringifies a function into a form that can be deserialized in the worker
 * @param fn
 */
export function stringifyFunction(fn) {
  let str = fn.toString()
  // If it was defined in object method/property format, it needs to be modified
  if (!/^function/.test(str) && /^\w+\s*\(/.test(str)) {
    str = 'function ' + str
  }
  return str
}


function getWorker(workerId) {
  let worker = workers[workerId]
  if (!worker) {
    // Bootstrap the worker's content
    const bootstrap = stringifyFunction(workerBootstrap)

    // Create the worker from the bootstrap function content
    worker = workers[workerId] = new Worker(
      URL.createObjectURL(
        new Blob(
          [`/** Worker Module Bootstrap: ${workerId.replace(/\*/g, '')} **/\n\n;(${bootstrap})()`],
          {type: 'application/javascript'}
        )
      )
    )

    // Single handler for response messages from the worker
    worker.onmessage = e => {
      const response = e.data
      const msgId = response.messageId
      const callback = openRequests[msgId]
      if (!callback) {
        throw new Error('WorkerModule response with empty or unknown messageId')
      }
      delete openRequests[msgId]
      openRequests.count--
      callback(response)
    }
  }
  return worker
}

// Issue a call to the worker with a callback to handle the response
function callWorker(workerId, action, data) {
  const thenable = Thenable()
  const messageId = ++_messageId
  openRequests[messageId] = response => {
    if (response.success) {
      thenable.resolve(response.result)
    } else {
      thenable.reject(new Error(`Error in worker ${action} call: ${response.error}`))
    }
  }
  openRequests._count++
  if (openRequests.count > 1000) { //detect leaks
    console.warn('Large number of open WorkerModule requests, some may not be returning')
  }
  getWorker(workerId).postMessage({
    messageId,
    action,
    data
  })
  return thenable
}

