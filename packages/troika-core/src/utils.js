///// Miscellaneous Utility Functions /////


/**
 * Pseudo-polyfilled shortcut for `Object.assign`. Copies own properties from
 * second-and-after arguments onto the first object, overwriting any that already
 * exist, and returns the first argument.
 * @return {object}
 */
export const assign = Object.assign || _assign

// Non-native impl; exported for access by tests
export function _assign(/*target, ...sources*/) {
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


/**
 * Like {@link assign}, but will ony copy properties that do _not_ already
 * exist on the target object.
 * @return {object}
 */
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

/**
 * Like {@link assign}, but for any property where the source and target are both
 * sub-objects, does a deep recursive copy.
 * @param {object} target
 * @param {object} source
 */
export function assignDeep(target, source) {
  if (source) {
    for (let prop in source) {
      if (source.hasOwnProperty(prop)) {
        if (target[prop] && typeof target[prop] === 'object' && typeof source[prop] === 'object') {
          assignDeep(target[prop], source[prop])
        } else {
          target[prop] = source[prop]
        }
      }
    }
  }
}


/**
 * Iterate over an object's own (non-prototype-inherited) properties
 * @param {object} object - The object to iterate over
 * @param {function} fn - A function that will be invoked for each iterated property. It
 *        will be passed three arguments:
 *        - value (the property value)
 *        - key (the property name)
 *        - object (the object being iterated over)
 * @param {*} [scope] - An optional object to be used as `this` when calling the `fn`
 */
export function forOwn(object, fn, scope) {
  for (let prop in object) {
    if (object.hasOwnProperty(prop)) {
      fn.call(scope, object[prop], prop, object)
    }
  }
}


/**
 * Given an object instance, return a consistent unique id for it.
 * @type function
 * @param {Object} obj - The object instance
 * @return {string} id
 */
export const getIdForObject = (() => {
  let objIds = new WeakMap()
  let lastId = 0
  return function getIdForObject(obj) {
    let id = objIds.get(obj)
    if (!id) {
      objIds.set(obj, (id = `$id${++lastId}`))
    }
    return id
  }
})()


/**
 * Create a function that memoizes the result of another function based on the most
 * recent call's arguments and `this`. The arguments are compared using strict shallow equality.
 * @param {function} fn
 * @return {function}
 */
export function memoize(fn) {
  let prevArgs, prevThis, prevResult
  return function() {
    let changed = !prevArgs || this !== prevThis || arguments.length !== prevArgs.length
    if (!changed) {
      for (let i = 0, len = arguments.length; i < len; i++) {
        if (arguments[i] !== prevArgs[i]) {
          changed = true
          break
        }
      }
    }
    if (changed) {
      prevArgs = Array.prototype.slice.call(arguments)
      prevThis = this
      prevResult = fn.apply(this, arguments)
    }
    return prevResult
  }
}


/**
 * Utility for the "extend-as" pattern used in several places to decorate facade
 * classes with extra capabilities.
 * @param {string} name - unique identifier for this class extension
 * @param {function} doExtend - the function that creates the actual class extension,
 *        this is passed the base class and will only be called once per base class.
 * @return {function(class): class}
 */
export function createClassExtender(name, doExtend) {
  const cache = new WeakMap()
  return function(classToExtend) {
    let extended = cache.get(classToExtend)
    if (!extended) { //bidir check due to inheritance of statics
      extended = doExtend(classToExtend)
      cache.set(classToExtend, extended)
    }
    return extended
  }
}


/**
 * Determine whether a given object is a React element descriptor object, i.e. the
 * result of a JSX transpilation to React.createElement().
 * @param obj
 * @return {boolean}
 */
export function isReactElement(obj) {
  const t = obj.$$typeof
  return (t && t.toString && t.toString() === 'Symbol(react.element)') || false
}

