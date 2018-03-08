

export const assign = Object.assign || function assign(/*target, ...sources*/) {
  let target = arguments[0]
  for (let i = 1, len = arguments.length; i < len; i++) {
    let source = arguments[i]
    if (source) {
      for (let prop in source) {
        if (source.hasOwnProperty(prop)) {
          target[prop] = source[prop]
        }
      }
    }
  }
  return target
}

export function assignIf(/*target, ...sources*/) {
  let target = arguments[0]
  for (let i = 1, len = arguments.length; i < len; i++) {
    let source = arguments[i]
    if (source) {
      for (let prop in source) {
        if (source.hasOwnProperty(prop) && !target.hasOwnProperty(prop)) {
          target[prop] = source[prop]
        }
      }
    }
  }
  return target
}

export function forOwn(object, fn, scope) {
  for (let prop in object) {
    if (object.hasOwnProperty(prop)) {
      fn.call(scope, object[prop], prop, object)
    }
  }
}

/*
export function isObjectEmpty(object) {
  for (let prop in object) {
    if (!object.hasOwnProperty || object.hasOwnProperty(prop)) {
      return false
    }
  }
  return true
}

export function arraysAreEqual(arr1, arr2) {
  if (arr1 !== arr2) {
    if ((arr1 && arr1.length) !== (arr2 && arr2.length)) {
      return false
    }
    for (let i = arr1.length; i--;) {
      if (arr1[i] !== arr2[i]) {
        return false
      }
    }
  }
  return true
}
*/

export function removeFromArray(arr, val) {
  let idx = arr.indexOf(val)
  if (idx > -1) arr.splice(idx, 1)
}

/**
 * Super lightweight thenable implementation, for handling async with Promise-like
 * ergonomics without relying on a complete Promise implementation or polyfill. This
 * does _not_ provide full Promise semantics so be careful using it and don't let it
 * leak outside of private impl confines.
 */
export function createThenable() {
  let handlers
  let resolved = false
  return {
    then(fn) {
      if (resolved) {
        fn()
      } else {
        (handlers || (handlers = [])).push(fn)
      }
    },
    resolve() {
      resolved = true
      if (handlers) {
        for (let i = handlers.length; i--;) {
          handlers[i]()
        }
        handlers = null
      }
    }
  }
}

