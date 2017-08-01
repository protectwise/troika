import Facade, {isSpecialDescriptorProperty} from './Facade'
import AnimatableDecorator from './AnimatableDecorator'

let warnedAboutClassToFacade = false

/**
 * ListFacade is an optimized way to define a large number of scene objects based on an array of data.
 * Unlike mapping a data array to `children` objects in the scene descriptor, ListFacade allows you to
 * define only a single "template" descriptor object whose properties are either constant values
 * or accessor functions that get invoked for each data item. The resulting property values are
 * then applied directly to the implementation objects, without creating any intermediary objects.
 *
 * Example:
 *
 *     {
 *       key: 'balls',
 *       facade: ListFacade,
 *       data: itemsData,
 *       template: {
 *         key: (item, i, all) => `ball_${ item.id }`,
 *         facade: Ball,
 *         x: (item, i, all) => item.time,
 *         y: (item, i, all) => item.count,
 *         radius: 10,
 *         color: (item, i, all) => item.important ? 0xff0000 : 0xcccccc
 *       }
 *     }
 */
export default class List extends Facade {
  afterUpdate() {
    let {data, template} = this
    let hasData = data && data.length && Array.isArray(data)

    // Some basic validation in dev mode
    if (process.env.NODE_ENV !== 'production') {
      if (data && !Array.isArray(data)) {
        throw new Error('ListFacade "data" must be an array.')
      }
      if (!template || typeof template !== 'object') {
        throw new Error('ListFacade "template" must be an object.')
      }
      if (!template || typeof template.key !== 'function') {
        throw new Error('ListFacade template must define a "key" function.')
      }
      if (!template || typeof template.facade !== 'function') {
        if (template && typeof template.class === 'function') {
          if (!warnedAboutClassToFacade) {
            console.warn('The "class" property is deprecated in favor of "facade".')
            warnedAboutClassToFacade = true
          }
          template.facade = template.class
        } else {
          throw new Error('ListFacade template must define a "facade".')
        }
      }
    }

    if (this.shouldUpdateChildren()) {
      let oldDict = this._itemsDict || null
      let newDict = this._itemsDict = hasData ? Object.create(null) : null

      if (hasData) {
        for (let i = 0, len = data.length; i < len; i++) {
          let childData = data[i]
          let key = template.key(childData, i, data)
          let facadeClass = template.facade

          // Some basic validation in dev mode
          if (process.env.NODE_ENV !== 'production') {
            if (!key || typeof key !== 'string') {
              throw new Error('ListFacade template "key" function must return a string.')
            }
            if (newDict[key]) {
              console.warn(`Duplicate key in list: ${key}`)
            }
          }
          while(newDict[key]) {
            key += '|dupe'
          }

          // If a transition/animation is present, upgrade the class to a AnimatableDecorator class on demand.
          // NOTE: changing between animatable/non-animatable results in a full teardown/recreation
          // of this instance *and its entire subtree*, so try to avoid that by always including the `transition`
          // definition if the object is expected to ever need transitions, even if it's temporarily empty.
          let transition = typeof template.transition === 'function' ? template.transition(childData, i, data) : template.transition
          let animation = typeof template.animation === 'function' ? template.animation(childData, i, data) : template.animation
          let exitAnimation = typeof template.exitAnimation === 'function' ? template.exitAnimation(childData, i, data) : template.exitAnimation
          if (transition || animation || exitAnimation) {
            facadeClass = facadeClass.$animatableDecoratorClass || (facadeClass.$animatableDecoratorClass = AnimatableDecorator(facadeClass))
          }

          // If we have an old instance with the same key and class, reuse it; otherwise instantiate a new one
          let oldImpl = oldDict && oldDict[key]
          let newImpl = oldImpl && oldImpl.constructor === facadeClass ? oldImpl : new facadeClass(this)
          //always set transition/animation before any other props
          newImpl.transition = transition
          newImpl.animation = animation
          for (let prop in template) {
            if (template.hasOwnProperty(prop) && !isSpecialDescriptorProperty(prop)) {
              newImpl[prop] = typeof template[prop] === 'function' ? template[prop](childData, i, data) : template[prop]
            }
          }
          newImpl.afterUpdate()
          newDict[key] = newImpl
        }
      }

      // Destroy all old child instances that weren't reused
      if (oldDict) {
        for (let key in oldDict) {
          if (!newDict || newDict[key] !== oldDict[key]) {
            oldDict[key].destructor()
          }
        }
      }
    }

    super.afterUpdate()
  }

  /**
   * Override to selectively prevent updating the ListFacade's items on `afterUpdate`, for
   * potential performance gain.
   * @returns {boolean}
   */
  shouldUpdateChildren() {
    return true
  }

  /**
   * Walk this facade's descendant tree, invoking a function for it and each descendant.
   * The iteration order is _not_ guaranteed to match the order in which children/lists
   * were declared. It may also include items that have been queued for removal but not
   * yet removed, e.g. facades in the process of an `exitAnimation`.
   * @param {Function} fn
   * @param {Object} [thisArg]
   */
  traverse(fn, thisArg) {
    fn.call(thisArg, this)
    let dict = this._itemsDict
    if (dict) {
      for (let key in dict) {
        dict[key].traverse(fn, thisArg)
      }
    }
  }

  /**
   * Iterate over this facade's direct child facades, invoking a function for each.
   * The iteration order is _not_ guaranteed to match the order in which the `data` items
   * were declared. It may also include items that have been queued for removal but not
   * yet removed, e.g. facades in the process of an `exitAnimation`.
   * @param {Function} fn
   * @param {Object} [thisArg]
   */
  forEachChild(fn, thisArg) {
    let dict = this._itemsDict
    if (dict) {
      for (let key in dict) {
        fn.call(thisArg, dict[key], key)
      }
    }
  }

  destructor() {
    // Destroy all child instances
    let dict = this._itemsDict
    if (dict) {
      this.isDestroying = true
      for (let key in dict) {
        dict[key].destructor()
      }
    }
    super.destructor()
  }
}
