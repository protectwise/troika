import Thenable from './Thenable'

let _workerModuleId = 0
let _messageId = 0
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
 * @param {string} [options.workerId] - By default all modules will run in the same dedicated worker,
 *        but if you want to use multiple workers you can pass a `workerId` to indicate a specific
 *        worker to spawn. Note that each worker is completely standalone and no data or state will
 *        be shared between them. If a worker module is used as a dependency by worker modules
 *        using different `workerId`s, then that dependency will be re-registered in each worker.
 * @return {function(...[*]): {then}}
 */
export function defineWorkerModule(options) {
  if (!options || typeof options.init !== 'function') {
    throw new Error('requires `options.init` function')
  }
  let {dependencies, init, getTransferables, workerId} = options
  if (workerId == null) {
    workerId = '#default'
  }
  const id = `workerModule${++_workerModuleId}`
  let registrationThenable = null

  dependencies = dependencies && dependencies.map(dep => {
    // Wrap raw functions as worker modules with no dependencies
    if (typeof dep === 'function' && !dep.workerModuleData) {
      dep = defineWorkerModule({
        workerId,
        init: new Function(`return function(){return (${stringifyFunction(dep)})}`)()
      })
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
function stringifyFunction(fn) {
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
    const bootstrap = (function() {
      const modules = Object.create(null)

      // Handle messages for registering a module
      function registerModule({id, dependencies=[], init=function(){}, getTransferables=null}, callback) {
        // Only register once
        if (modules[id]) return

        try {
          // If any dependencies are modules, ensure they're registered and grab their value
          dependencies = dependencies.map(dep => {
            if (dep && dep.isWorkerModule) {
              registerModule(dep, depResult => {
                if (depResult instanceof Error) throw depResult
              })
              dep = modules[dep.id].value
            }
            return dep
          })

          // Rehydrate functions
          init = new Function(`return (${init})`)()
          if (getTransferables) {
            getTransferables = new Function(`return (${getTransferables})`)()
          }

          // Initialize the module and store its value
          const value = init(...dependencies)
          modules[id] = {
            id,
            value,
            getTransferables
          }
          callback(value)
        } catch(err) {
          if (!(err && err.noLog)) {
            console.error(err)
          }
          callback(err)
        }
      }

      // Handle messages for calling a registered module's result function
      function callModule({id, args}, callback) {
        if (!modules[id] || typeof modules[id].value !== 'function') {
          callback(new Error(`Worker module ${id}: not found or its 'init' did not return a function`))
        }
        try {
          const result = modules[id].value(...args)
          if (result && typeof result.then === 'function') {
            result.then(handleResult, rej => callback(rej instanceof Error ? rej : new Error('' + rej)))
          } else {
            handleResult(result)
          }
        } catch(err) {
          callback(err)
        }
        function handleResult(result) {
          try {
            let tx = modules[id].getTransferables && modules[id].getTransferables(result)
            if (!tx || !Array.isArray(tx) || !tx.length) {
              tx = undefined //postMessage is very picky about not passing null or empty transferables
            }
            callback(result, tx)
          } catch(err) {
            console.error(err)
            callback(err)
          }
        }
      }

      // Handler for all messages within the worker
      self.addEventListener('message', e => {
        const {messageId, action, data} = e.data
        try {
          // Module registration
          if (action === 'registerModule') {
            registerModule(data, result => {
              if (result instanceof Error) {
                postMessage({
                  messageId,
                  success: false,
                  error: result.message
                })
              } else {
                postMessage({
                  messageId,
                  success: true,
                  result: {isCallable: typeof result === 'function'}
                })
              }
            })
          }
          // Invocation
          if (action === 'callModule') {
            callModule(data, (result, transferables) => {
              if (result instanceof Error) {
                postMessage({
                  messageId,
                  success: false,
                  error: result.message
                })
              } else {
                postMessage({
                  messageId,
                  success: true,
                  result
                }, transferables || undefined)
              }
            })
          }
        } catch(err) {
          postMessage({
            messageId,
            success: false,
            error: err.stack
          })
        }
      })
    }).toString()

    // Create the worker from the bootstrap function content
    worker = workers[workerId] = new Worker(
      URL.createObjectURL(
        new Blob([`;(${bootstrap})()`], {type: 'application/javascript'})
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

