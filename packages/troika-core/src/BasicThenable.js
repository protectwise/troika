/**
 * Super lightweight thenable implementation, for handling async with Promise-like
 * ergonomics without relying on a complete Promise implementation or polyfill, and
 * wrapped as a single function so it can be easily shipped across to a WorkerModule.
 * This does _not_ provide full Promise semantics so be careful using it and don't let
 * it leak outside of private impl confines.
 */
export default function BasicThenable () {
  let queue
  let isResolved = false
  let isRejected = false
  let resultValue = null

  function then (onResolve, onReject) {
    const nextThenable = BasicThenable()

    function complete () {
      const cb = isResolved ? onResolve : onReject
      if (cb) {
        try {
          const result = cb(resultValue)
          if (result && result.then) {
            result.then(nextThenable.resolve, nextThenable.reject)
          } else {
            nextThenable.resolve(result)
          }
        } catch (err) {
          nextThenable.reject(err)
        }
      } else {
        nextThenable[isResolved ? 'resolve' : 'reject'](resultValue)
      }
    }

    if (isResolved || isRejected) {
      complete()
    } else {
      (queue || (queue = [])).push(complete)
    }
    return nextThenable
  }

  function resolve (val) {
    isResolved = true
    resultValue = val
    flushQueue()
  }

  function reject (val) {
    isRejected = true
    resultValue = val
    flushQueue()
  }

  function flushQueue () {
    if (queue) {
      queue.forEach(fn => fn())
      queue = null
    }
  }

  return {
    then,
    resolve,
    reject
  }
}