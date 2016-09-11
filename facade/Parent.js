import FacadeBase, {isSpecialDescriptorProperty} from './FacadeBase'
import Transitionable from './Transitionable'


/**
 * Base facade class for objects that have `children`. Manages creating and destroying child
 * facade instances as needed as its `children` array changes.
 *
 * If you need to create a large number of child objects based on an array of incoming data,
 * consider using a `List` instead of a parent object with a large `children` array, since
 * that requires only a single template descriptor object instead of one for every child.
 */
export default class Parent extends FacadeBase {
  constructor(parent) {
    super(parent)
    this.children = null
  }

  afterUpdate() {
    if (this.children) {
      this.updateChildren(this.children)
    }
  }

  updateChildren(children) {
    let oldDict = this._childrenDict || Object.create(null)
    let newDict = this._childrenDict = Object.create(null)

    for (let i = 0, len = children.length; i < len; i++) {
      let childDesc = children[i]
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
      }

      // If a transition is present, upgrade the class to a Transitionable wrapper class on demand.
      // NOTE: changing between transitionable/non-transitionable results in a full teardown/recreation
      // of this instance *and its entire subtree*, so try to avoid that by always including the `transition`
      // definition if the object is expected to ever need transitions, even if it's temporarily empty.
      let transition = childDesc.transition
      if (transition) {
        cla$$ = cla$$.$transitionableClass || (cla$$.$transitionableClass = Transitionable(cla$$))
      }

      // If we have an old instance with the same key and class, update it, otherwise instantiate a new one
      let oldImpl = oldDict[key]
      let newImpl = oldImpl && (oldImpl.constructor === cla$$) ? oldImpl : new cla$$(this)
      newImpl.transition = transition //always set transition first
      for (let prop in childDesc) {
        if (childDesc.hasOwnProperty(prop) && !isSpecialDescriptorProperty(prop)) {
          newImpl[prop] = childDesc[prop]
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

  getChildByKey(key) {
    let dict = this._childrenDict
    return dict && dict[key]
  }

  destructor() {
    // Destroy all child instances
    if (this._childrenDict) {
      for (let key in this._childrenDict) {
        this._childrenDict[key].destructor()
      }
    }
    super.destructor()
  }
}
