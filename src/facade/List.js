import FacadeBase, {isSpecialDescriptorProperty} from './FacadeBase'
import Animatable from './Animatable'


/**
 * List is an optimized way to define a large number of scene objects based on an array of data.
 * Unlike mapping a data array to `children` objects in the scene descriptor, List allows you to
 * define only a single "template" descriptor object whose properties are either constant values
 * or accessor functions that get invoked for each data item. The resulting property values are
 * then applied directly to the implementation objects, without creating any intermediary objects.
 *
 * Example:
 *
 *     {
 *       key: 'balls',
 *       class: List,
 *       data: itemsData,
 *       template: {
 *         key: (item, i, all) => `ball_${ item.id }`,
 *         class: Ball,
 *         x: (item, i, all) => item.time,
 *         y: (item, i, all) => item.count,
 *         radius: 10,
 *         color: (item, i, all) => item.important ? 0xff0000 : 0xcccccc
 *       }
 *     }
 */
export default class List extends FacadeBase {
  afterUpdate() {
    let {data, template} = this
    let hasData = data && data.length && Array.isArray(data)

    let oldDict = this._itemsDict || null
    let newDict = this._itemsDict = hasData ? Object.create(null) : null

    // Some basic validation in dev mode
    if (process.env.NODE_ENV !== 'production') {
      if (!Array.isArray(data)) {
        throw 'List "data" must be an array.'
      }
      if (!template || typeof template !== 'object') {
        throw 'List "template" must be an object.'
      }
      if (!template || typeof template.key !== 'function') {
        throw 'List template must define a "key" function.'
      }
      if (!template || typeof template.class !== 'function') {
        throw 'List template must define a "class".'
      }
    }

    if (this.shouldUpdateChildren()) {
      if (hasData) {
        for (let i = 0, len = data.length; i < len; i++) {
          let childData = data[i]
          let key = template.key(childData, i, data)
          let cla$$ = template.class

          // Some basic validation in dev mode
          if (process.env.NODE_ENV !== 'production') {
            if (!key || typeof key !== 'string') {
              throw 'List template "key" function must return a string.'
            }
          }

          // If a transition/animation is present, upgrade the class to a Animatable wrapper class on demand.
          // NOTE: changing between animatable/non-animatable results in a full teardown/recreation
          // of this instance *and its entire subtree*, so try to avoid that by always including the `transition`
          // definition if the object is expected to ever need transitions, even if it's temporarily empty.
          let transition = typeof template.transition === 'function' ? template.transition(childData, i, data) : template.transition
          let animation = typeof template.animation === 'function' ? template.animation(childData, i, data) : template.animation
          let exitAnimation = typeof template.exitAnimation === 'function' ? template.exitAnimation(childData, i, data) : template.exitAnimation
          if (transition || animation || exitAnimation) {
            cla$$ = cla$$.$animatableWrapperClass || (cla$$.$animatableWrapperClass = Animatable(cla$$))
          }

          // If we have an old instance with the same key and class, reuse it; otherwise instantiate a new one
          let oldImpl = oldDict && oldDict[key]
          let newImpl = oldImpl && oldImpl.constructor === cla$$ ? oldImpl : new cla$$(this)
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
   * Override to selectively prevent updating the List's items on `afterUpdate`, for
   * potential performance gain.
   * @returns {boolean}
   */
  shouldUpdateChildren() {
    return true
  }

  destructor() {
    // Destroy all child instances
    if (this._itemsDict) {
      this.isDestroying = true
      for (let key in this._itemsDict) {
        this._itemsDict[key].destructor()
      }
    }
    super.destructor()
  }
}
