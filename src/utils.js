

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

export function forOwn(object, fn) {
  for (let prop in object) {
    if (object.hasOwnProperty(prop)) {
      fn(object[prop], prop, object)
    }
  }
}

export function isObjectEmpty(object) {
  for (let prop in object) {
    if (!object.hasOwnProperty || object.hasOwnProperty(prop)) {
      return false
    }
  }
  return true
}
