import {assign} from '../utils'

/**
 * The base class for all Facade classes.
 *
 * A Facade is basically just a class that receives property assignments from a scene descriptor
 * and manages forwarding the resulting state to more complex underlying implementation
 * objects, e.g. ThreeJS objects.
 *
 * The instantiated facade objects have a very simple lifecycle:
 *   - The `constructor` in which the initial state and the underyling implementation object(s)
 *     can be initialized. It will be passed a single argument: the `parent` facade object.
 *   - Updates to the object's properties, usually by direct assignment from the scene descriptor.
 *     These updates can be handled immediately by defining property setters that handle syncing
 *     new values to the underyling implementation object(s).
 *   - The `afterUpdate()` method which signals the end of all property updates; this can be
 *     implemented to handle syncing the full set of updated properties to the underlying
 *     implementation object(s). Useful if an aspect of the syncing relies on multiple properties
 *     or needs things to be synced in a specific order.
 *   - The `destructor` method which is always called when the object is removed from the scene.
 *     Implement this to remove and clean up the underlying implementation object(s) and other
 *     cleanup logic.
 *
 * Scene Descriptors:
 *
 * All facade instances are created, updated, and destroyed based on the current structure of
 * a scene descriptor object. The properties in the descriptor are generally just copied
 * directly to properties of the same names on the facade instance, which can handle them
 * either by custom setters or in `afterUpdate`. There are a few special properties in the
 * descriptor:
 *
 *   - `key`: (required) an identifier that is unique amongst the descriptor's siblings, which
 *     is used to associate the descriptor with its corresponding Facade instance.
 *   - `facade`: (required) a reference to the Facade class that will be instantiated.
 *   - `children`: (optional) for `Parent` facade subclasses, defines the child object descriptors.
 *   - `transition`: (optional) defines a set of properties that should be transitioned smoothly
 *     when their value changes. See `Animatable` for more details.
 *   - `animation`: (optional) defines one or more keyframe animations. See `Animatable` for more details.
 *   - `exitAnimation`: (optional) defines a keyframe animation to run when the facade is removed from its parent.
 */
export default class Facade {
  constructor(parent) {
    this.$facadeId = `facade${ idCounter++ }`
    this.parent = parent
  }

  /**
   * Called at the end of an update batch, after all individual properties have been assigned.
   */
  afterUpdate() {
    // Handle calling ref function
    let ref = this.ref
    if (ref !== this._lastRef) {
      if (typeof this._lastRef === 'function') {
        this._lastRef.call(null, null)
      }
      if (typeof ref === 'function') {
        ref.call(null, this)
        this._lastRef = ref
      } else {
        this._lastRef = null
      }
    }
  }

  /**
   * Dispatch a message with optional data up the facade parent tree.
   */
  notifyWorld(message, data) {
    if (this.parent) {
      this.parent.onNotifyWorld(this, message, data)
    }
  }

  /**
   * Default onNotifyWorld handler just bubbles it up the parent chain.
   */
  onNotifyWorld(source, message, data) {
    let notifiableParent = this._notifiableParent
    if (notifiableParent) {
      notifiableParent.onNotifyWorld.call(notifiableParent, source, message, data)
    } else {
      // Optimization: on first call, walk up the tree looking for the first ancestor with a
      // non-default onNotifyWorld implementation, and save a pointer to that ancestor
      // facade so we can just call it directly the next time without any tree walking.
      notifiableParent = this.parent
      let defaultImpl = Facade.prototype.onNotifyWorld
      while (notifiableParent) {
        if (notifiableParent.onNotifyWorld !== defaultImpl) {
          this._notifiableParent = notifiableParent
          notifiableParent.onNotifyWorld(source, message, data)
          break
        }
        notifiableParent = notifiableParent.parent
      }
    }
  }

  traverse(fn) {
    fn(this)
  }

  forEachChild(fn) {
  }

  /**
   * Called when the instance is being removed from the scene. Override this to implement any
   * custom cleanup logic.
   */
  destructor() {
    // Unregister all event listeners from the world
    if (this.parent) {
      this.notifyWorld('removeAllEventListeners')
    }

    // Teardown refs
    if (typeof this.ref === 'function') {
      this.ref.call(null, null)
    }
    this.parent = this._notifiableParent = null
  }
}

assign(Facade.prototype, {
  ref: null,
  _lastRef: null,
  _notifiableParent: null
})


let idCounter = 0
const DEF_SPECIAL_PROPS = {key:1, 'class':1, facade:1, transition:1, animation:1}

/**
 * Determine if a certain property name is one of the special descriptor properties
 */
export function isSpecialDescriptorProperty(name) {
  return DEF_SPECIAL_PROPS.hasOwnProperty(name)
}

/**
 * Define a property name as an event handler for a given Facade class, so that it
 * automatically updates the global event registry when set.
 * @param facadeClass
 * @param eventName
 */
export function defineEventProperty(facadeClass, eventName) {
  let privateProp = `${eventName}➤handler`
  Object.defineProperty(facadeClass.prototype, eventName, {
    get() {
      return this[privateProp]
    },
    set(handler) {
      if ((handler || null) !== (this[privateProp] || null)) {
        this[privateProp] = handler

        // Add/remove from the global event registry
        this.notifyWorld(handler ? 'addEventListener' : 'removeEventListener', {
          type: eventName,
          handler: handler
        })
      }
    }
  })
}

