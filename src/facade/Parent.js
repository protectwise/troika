import Facade, {isSpecialDescriptorProperty} from './Facade'
import AnimatableDecorator from './AnimatableDecorator'

const TEMP_ARRAY = [null]


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
    this.children = null
  }

  afterUpdate() {
    if (this.shouldUpdateChildren()) {
      this.updateChildren(this.children)
    }
    super.afterUpdate()
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
    let oldDict = this._childrenDict || null
    let newDict = this._childrenDict = null

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
        let key = childDesc.key
        let cla$$ = childDesc.class

        // Some basic validation in dev mode
        if (process.env.NODE_ENV !== 'production') {
          if (!key || !cla$$) {
            throw 'All scene objects must have a "key" and "class" defined.'
          }
          if (typeof cla$$ !== 'function') {
            throw 'The "class" property must point to a constructor function.'
          }
          if (newDict[key]) {
            console.warn(`Duplicate key in children: ${key}`)
          }
        }
        while(newDict[key]) {
          key += '|dupe'
        }

        // If a transition/animation is present, upgrade the class to a AnimatableDecorator class on demand.
        // NOTE: changing between animatable/non-animatable results in a full teardown/recreation
        // of this instance *and its entire subtree*, so try to avoid that by always including the `transition`
        // definition if the object is expected to ever need transitions, even if it's temporarily empty.
        let transition = childDesc.transition
        let animation = childDesc.animation
        if (transition || animation || childDesc.exitAnimation) {
          cla$$ = cla$$.$animatableDecoratorClass || (cla$$.$animatableDecoratorClass = AnimatableDecorator(cla$$))
        }

        // If we have an old instance with the same key and class, update it, otherwise instantiate a new one
        let oldImpl = oldDict && oldDict[key]
        let newImpl = oldImpl && (oldImpl.constructor === cla$$) ? oldImpl : new cla$$(this)
        //always set transition/animation before any other props
        newImpl.transition = transition
        newImpl.animation = animation
        for (let prop in childDesc) {
          if (childDesc.hasOwnProperty(prop) && !isSpecialDescriptorProperty(prop)) {
            newImpl[prop] = childDesc[prop]
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

  getChildByKey(key) {
    let dict = this._childrenDict
    return dict && dict[key]
  }

  /**
   * Walk this facade's descendant tree, invoking a function for it and each descendant.
   * @param {Function} fn
   */
  traverse(fn) {
    fn(this)
    let dict = this._childrenDict
    if (dict) {
      for (let key in dict) {
        dict[key].traverse(fn)
      }
    }
  }

  destructor() {
    // Destroy all child instances
    let dict = this._childrenDict
    if (dict) {
      this.isDestroying = true
      for (let key in dict) {
        dict[key].destructor()
      }
    }
    super.destructor()
  }
}
