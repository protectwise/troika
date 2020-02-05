import {assign} from '../utils.js'

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
 *   - `facade`: (required) a reference to the Facade class that will be instantiated.
 *   - `key`: (recommended) an identifier that is unique amongst the descriptor's siblings, which
 *     is used to associate the descriptor with its corresponding Facade instance. One will be
 *     assigned automatically if omitted, but it's recommended that you set one manually to ensure
 *     descriptors are predictably resolved to the same facade instances when siblings are being
 *     added or removed. Not doing so can lead to unnecessary facade destruction/creation and/or
 *     unpredictable facade states.
 *   - `children`: (optional) for `Parent` facade subclasses, defines the child object descriptors.
 *   - `ref`: (optional) a function that will be called with a reference to the instantiated Facade
 *     on creation, and with `null` on destruction, allowing external code to maintain references
 *     to individual facades.
 *   - `transition`: (optional) defines a set of properties that should be transitioned smoothly
 *     when their value changes. See `Animatable` for more details.
 *   - `animation`: (optional) defines one or more keyframe animations. See `Animatable` for more
 *     details.
 *   - `exitAnimation`: (optional) defines a keyframe animation to run when the facade is removed
 *     from its parent.
 *   - `pointerStates`: (optional) defines sets of property values that should be used in place
 *     of those defined on the main object, when the user's pointer (mouse, touch, vr controller,
 *     etc.) is in `hover` or `active` interaction state with the facade. See `PointerStates`
 *     for more details.
 *
 * It is also possible to define facade descriptors using JSX (https://reactjs.org/docs/introducing-jsx.html),
 * if it is precompiled to `React.createElement` calls. In this case, use the facade class as the JSX
 * element name instead of a `facade` property, and child descriptors are defined as nested JSX elements i
 * nstead of a `children` property. *NOTE:* While this is often a nicer looking syntax than the plain JS object
 * form, be aware that the creation of JSX elements does carry a slight performance cost from extra logic
 * and object allocations, so you should avoid it when defining large numbers of facades or when updating
 * descriptors on every frame.
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
   * Add an event listener for the given event type.
   * @param {String} type
   * @param {Function} handler
   */
  addEventListener(type, handler) {
    this.notifyWorld('addEventListener', {type, handler})
  }

  /**
   * Remove an event listener for the given event type.
   * @param {String} type
   * @param {Function} handler
   */
  removeEventListener(type, handler) {
    this.notifyWorld('removeEventListener', {type, handler})
  }

  /**
   * Dispatch an Event object on this facade, with DOM events bubbling logic.
   * @param {Event} event
   */
  dispatchEvent(event) {
    this.notifyWorld('dispatchEvent', event)
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
const DEF_SPECIAL_PROPS = {key:1, facade:1, transition:1, animation:1}

/**
 * @static
 * Determine if a certain property name is one of the special descriptor properties
 */
Facade.isSpecialDescriptorProperty = function(name) {
  return DEF_SPECIAL_PROPS.hasOwnProperty(name)
}

/**
 * @static
 * Define a property name as an event handler for a given Facade class, so that it
 * automatically updates the global event registry when set.
 * @param {class} facadeClass - the class whose prototype the property should be defined on
 * @param {String} propName - the name of the event handler property, e.g. 'onMouseOver'
 * @param {String} eventType - the type of the event that will trigger the handler, e.g. 'mouseover'
 */
Facade.defineEventProperty = function(facadeClass, propName, eventType) {
  let privateProp = `${propName}➤handler`
  Object.defineProperty(facadeClass.prototype, propName, {
    get() {
      return this[privateProp]
    },
    set(handler) {
      const oldHandler = this[privateProp]
      if ((handler || null) !== (oldHandler || null)) {
        // Remove old listener
        if (typeof oldHandler === 'function') {
          this.removeEventListener(eventType, oldHandler)
        }
        // Add new listener
        if (typeof handler === 'function') {
          this.addEventListener(eventType, handler)
        }
        this[privateProp] = handler
      }
    }
  })
}

