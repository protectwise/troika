import _ from 'lodash'
import FacadeBase, {isSpecialDescriptorProperty} from './FacadeBase'
import Transitionable from './Transitionable'


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
    if (!data) return

    let oldDict = this._itemsDict || Object.create(null)
    let newDict = this._itemsDict = Object.create(null)

    // Some basic validation in dev mode
    if (process.env.NODE_ENV !== 'production') {
      if (!_.isArray(data)) {
        throw 'List "data" must be an array.'
      }
      if (!_.isObject(template)) {
        throw 'List "template" must be an object.'
      }
      if (!_.isFunction(template.key)) {
        throw 'List template must define a "key" function.'
      }
      if (!_.isFunction(template.class)) {
        throw 'List template must define a "class".'
      }
    }

    for (let i = 0, len = data.length; i < len; i++) {
      let childData = data[i]
      let key = template.key(childData, i, data)
      let cla$$ = template.class

      // Some basic validation in dev mode
      if (process.env.NODE_ENV !== 'production') {
        if (!key || !_.isString(key)) {
          throw 'List template "key" function must return a string.'
        }
      }

      // If a transition is present, upgrade the class to a Transitionable wrapper class on demand.
      // NOTE: changing between transitionable/non-transitionable results in a full teardown/recreation
      // of this instance *and its entire subtree*, so try to avoid that by always including the `transition`
      // definition if the object is expected to ever need transitions, even if it's temporarily empty.
      let transition = typeof template.transition === 'function' ? template.transition(childData, i, data) : template.transition
      if (transition) {
        cla$$ = cla$$.$transitionableClass || (cla$$.$transitionableClass = Transitionable(cla$$))
      }

      // If we have an old instance with the same key and class, reuse it; otherwise instantiate a new one
      let oldImpl = oldDict[key]
      let newImpl = oldImpl && oldImpl.constructor === cla$$ ? oldImpl : new cla$$(this)
      newImpl.transition = transition //always set transition before any other props
      for (let prop in template) {
        if (template.hasOwnProperty(prop) && !isSpecialDescriptorProperty(prop)) {
          newImpl[prop] = typeof template[prop] === 'function' ? template[prop](childData, i, data) : template[prop]
        }
      }
      newImpl.afterUpdate()
      newDict[key] = newImpl
    }

    // Destroy all old child instances that weren't reused
    for (let key in oldDict) {
      if (newDict[key] !== oldDict[key]) {
        oldDict[key].destructor()
      }
    }
  }
}
