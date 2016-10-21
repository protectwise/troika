import FacadeBase, {isSpecialDescriptorProperty} from './FacadeBase'
import Animatable from './Animatable'


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
    this.updateChildren(this.children)
    super.afterUpdate()
  }

  updateChildren(children) {
    let oldDict = this._childrenDict || Object.create(null)
    let newDict = this._childrenDict = Object.create(null)

    if (children) {
      for (let i = 0, len = children.length; i < len; i++) {
        let childDesc = children[i]
        if (!childDesc) continue //child members can be null
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

        // If a transition/animation is present, upgrade the class to a Animatable wrapper class on demand.
        // NOTE: changing between animatable/non-animatable results in a full teardown/recreation
        // of this instance *and its entire subtree*, so try to avoid that by always including the `transition`
        // definition if the object is expected to ever need transitions, even if it's temporarily empty.
        let transition = childDesc.transition
        let animation = childDesc.animation
        if (transition || animation) {
          cla$$ = cla$$.$animatableWrapperClass || (cla$$.$animatableWrapperClass = Animatable(cla$$))
        }

        // If we have an old instance with the same key and class, update it, otherwise instantiate a new one
        let oldImpl = oldDict[key]
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
