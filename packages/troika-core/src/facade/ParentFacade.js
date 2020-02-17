import Facade from './Facade.js'
import {extendAsAnimatable} from './Animatable.js'
import {isReactElement} from '../utils.js'
import { extendAsPointerStatesAware } from './PointerStates.js'

const TEMP_ARRAY = [null]

/**
 * @typedef {object} FacadeDescriptor
 * An object describing the type and properties of a child facade to be created and managed by
 * its parent. See the detailed description in the docs for {@link Facade.js}.
 * @property {class} facade
 * @property {string|number} [key]
 */


/**
 * Base facade class for objects that have `children`. Manages creating and destroying child
 * facade instances as needed as its `children` array changes.
 *
 * If you need to create a large number of child objects based on an array of incoming data,
 * consider using a `ListFacade` instead of a parent object with a large `children` array, since
 * that requires only a single template descriptor object instead of one for every child.
 */
export default class ParentFacade extends Facade {
  constructor(parent) {
    super(parent)

    /**
     * @member {FacadeDescriptor | Array<FacadeDescriptor>} children
     * Descriptors for one or more child facades.
     */
    this.children = null

    this._orderedChildKeys = []
  }

  afterUpdate() {
    if (this.shouldUpdateChildren()) {
      this.updateChildren(this.describeChildren())
    }
    super.afterUpdate()
  }

  /**
   * Return the descriptor(s) for the actual children to be created and managed. By default
   * this simply returns the value of the `children` property set by the parent, but you can
   * override it to customize how the child content should be structured, for instance to wrap
   * the `children` within a deeper structure, add in anonymous child siblings, or modify the
   * `children` configurations.
   * @protected
   * @return {FacadeDescriptor | Array<FacadeDescriptor>}
   */
  describeChildren() {
    return this.children
  }

  /**
   * Override to selectively prevent traversing to child nodes on `afterUpdate`, for
   * potential performance gain.
   * @returns {boolean}
   */
  shouldUpdateChildren() {
    return true
  }

  updateChildren(children) {
    const oldDict = this._childrenDict || null
    let newDict = this._childrenDict = null
    const orderedChildKeys = this._orderedChildKeys
    orderedChildKeys.length = 0

    if (children) {
      // Allow single child without wrapper array
      if (!Array.isArray(children)) {
        TEMP_ARRAY[0] = children
        children = TEMP_ARRAY
      }

      for (let i = 0, len = children.length; i < len; i++) {
        let childDesc = children[i]
        if (!childDesc) continue //child members can be null
        if (!newDict) {
          newDict = this._childrenDict = Object.create(null)
        }

        // Handle child descriptors defined via a JSX->React.createElement() transforms (ReactElement objects)
        const isJSX = isReactElement(childDesc)
        let propsObj = isJSX ? childDesc.props : childDesc
        let facadeClass = isJSX ? childDesc.type : childDesc.facade

        // Find this child's key; if not specified by the author, build one from the facade class name
        let key = childDesc.key
        if (!key) {
          let j = 0
          do {
            key = `auto:${facadeClass.name}:${j++}`
          } while (newDict[key])
        }

        // Some basic validation in dev mode
        if (process.env.NODE_ENV !== 'production') {
          if (typeof facadeClass !== 'function') {
            throw new Error('All scene objects must have a "facade" property pointing to a class/constructor')
          }
        }
        if (newDict[key]) {
          console.warn(`Duplicate key in children: ${key}`)
          while(newDict[key]) {
            key += '|dupe'
          }
        }

        // If a transition/animation is present, upgrade the class to a Animatable class on demand.
        // NOTE: changing between animatable/non-animatable results in a full teardown/recreation
        // of this instance *and its entire subtree*, so try to avoid that by always including the `transition`
        // definition if the object is expected to ever need transitions, even if it's temporarily empty.
        let transition = propsObj.transition
        let animation = propsObj.animation
        if (transition || animation || propsObj.exitAnimation) {
          facadeClass = extendAsAnimatable(facadeClass)
        }

        // Same for pointer states
        if (propsObj.pointerStates) {
          facadeClass = extendAsPointerStatesAware(facadeClass)
        }

        // If we have an old instance with the same key and class, update it, otherwise instantiate a new one
        let oldImpl = oldDict && oldDict[key]
        let newImpl
        if (oldImpl && oldImpl.constructor === facadeClass) {
          newImpl = oldImpl
        } else {
          // If swapping instance need to destroy the old before creating the new, e.g. for `ref` call ordering
          if (oldImpl) oldImpl.destructor()
          newImpl = new facadeClass(this)
        }
        //always set transition/animation before any other props
        newImpl.transition = transition
        newImpl.animation = animation
        for (let prop in propsObj) {
          if (propsObj.hasOwnProperty(prop) && !Facade.isSpecialDescriptorProperty(prop)) {
            newImpl[prop] = propsObj[prop]
          }
        }
        newDict[key] = newImpl
        orderedChildKeys.push(key)
        newImpl.afterUpdate()
      }
    }

    // Destroy all old child instances that were not reused or replaced
    if (oldDict) {
      for (let key in oldDict) {
        if (!newDict || !newDict[key]) {
          oldDict[key].destructor()
        }
      }
    }
  }

  getChildByKey(key) {
    let dict = this._childrenDict
    return dict && dict[key] || null
  }

  /**
   * Walk this facade's descendant tree, invoking a function for it and each descendant.
   * The iteration order will match the order in which the `children` were declared. It may
   * also include items that have been queued for removal but not yet removed, e.g. facades
   * in the process of an `exitAnimation`.
   * @param {Function} fn
   * @param {Object} [thisArg]
   */
  traverse(fn, thisArg) {
    fn.call(thisArg, this)
    const keys = this._orderedChildKeys
    const dict = this._childrenDict
    for (let i = 0, len = keys.length; i < len; i++) {
      dict[keys[i]].traverse(fn, thisArg)
    }
  }

  /**
   * Iterate over this facade's direct child facades, invoking a function for each.
   * The iteration order will match the order in which the `children` were declared. It may
   * also include items that have been queued for removal but not yet removed, e.g. facades
   * in the process of an `exitAnimation`.
   * @param {Function} fn
   * @param {Object} [thisArg]
   */
  forEachChild(fn, thisArg) {
    const keys = this._orderedChildKeys
    const dict = this._childrenDict
    for (let i = 0, len = keys.length; i < len; i++) {
      fn.call(thisArg, dict[keys[i]], keys[i])
    }
  }

  destructor() {
    this.isDestroying = true
    // Destroy all child instances
    let dict = this._childrenDict
    if (dict) {
      for (let key in dict) {
        dict[key].destructor()
      }
    }
    super.destructor()
  }
}
