import { assign, createClassExtender } from '../utils.js'

/**
 * Allows a facade to be configured with an optional `pointerStates` property, which defines
 * sets of property values that should be used in place of the object's actual values when
 * the user interacts with the facade using their pointer device (mouse, touch, vr controller, etc.)
 * This is not used directly, but is automatically wrapped by `ParentFacade` and `ListFacade` when
 * setting up their children if the `pointerStates` property is present.
 *
 * The `pointerStates` property should point to an object with `hover` and/or `active` properties,
 * each of which is an object holding the individual properties to be used in those states. Any
 * properties defined in `active` will take precedence over those defined in `hover`.
 *
 * The properties will honor any `transition`s defined for them, but the `transition` must be
 * defined on the facade's main configuration object, not within the pointerStates themselves.
 */
export const extendAsPointerStatesAware = createClassExtender('pointerStates', function(BaseFacadeClass) {
  const isHoveringProp = '➤pntr:isHovering'
  const isActiveProp = '➤pntr:isActive'
  const propsWithInterceptors = Object.create(null)

  class PointerStatesAware extends BaseFacadeClass {
    constructor(parent) {
      super(parent)
      this.addEventListener('mouseover', hoverOverHandler)
      this.addEventListener('mouseout', hoverOutHandler)
      this.addEventListener('mousedown', activeDownHandler)
      this.addEventListener('mouseup', activeUpHandler)
    }

    afterUpdate() {
      this._applyPointerStates()
      super.afterUpdate()
    }

    _applyPointerStates() {
      const pointerStates = this.pointerStates
      const hoverValuesToUse = (pointerStates && this[isHoveringProp] && pointerStates.hover) || null
      const activeValuesToUse = (pointerStates && this[isActiveProp] && pointerStates.active) || null

      const lastAppliedValues = this['➤pntr:lastAppliedValues'] || propsWithInterceptors
      const appliedValues = this['➤pntr:lastAppliedValues'] =
        (hoverValuesToUse || activeValuesToUse) ? assign(Object.create(null), hoverValuesToUse, activeValuesToUse) : null

      if (appliedValues) {
        for (let prop in appliedValues) {
          definePropInterceptor(prop, this)
          actuallySet(this, prop, appliedValues[prop])
        }
      }

      if (lastAppliedValues) {
        for (let prop in lastAppliedValues) {
          if (!appliedValues || !(prop in appliedValues)) {
            actuallySet(this, prop, this[`${prop}➤pntr:baseValue`])
          }
        }
      }
    }
  }

  // Flag for identification
  Object.defineProperty(PointerStatesAware.prototype, 'isPointerStateAware', {value: true})

  // Add get/set interceptor to the wrapper's prototype if this is the first time seeing this prop. Putting it
  // on the wrapper prototype allows us to avoid per-instance overhead as well as avoid collisions with
  // other custom setters anywhere else in the prototype chain.
  function definePropInterceptor(propName, currentInstance) {
    // On first set for this instance, move the prop's previous value, if any, to the private property
    const hasBeenSetProp = `${propName}➤pntr:hasBeenSet`
    if (!currentInstance[hasBeenSetProp]) {
      currentInstance[`${ propName }➤pntr:baseValue`] = currentInstance[propName]
      delete currentInstance[propName] //remove own prop so it doesn't override the prototype getter/setter
      currentInstance[hasBeenSetProp] = true
    }

    if (!PointerStatesAware.prototype.hasOwnProperty(propName)) {
      propsWithInterceptors[propName] = 1
      const baseValueProp = `${ propName }➤pntr:baseValue`
      const appliedValueProp = `${propName}➤pntr:appliedValue`

      Object.defineProperty(PointerStatesAware.prototype, propName, {
        get() {
          const superGetter = getSuperGetter(propName)
          return superGetter ? superGetter.call(this) :
            (appliedValueProp in this) ? this[appliedValueProp] :
            this[baseValueProp]
        },

        set(value) {
          this[baseValueProp] = value
        }
      })
    }
  }

  function actuallySet(instance, propName, value) {
    const superSetter = getSuperSetter(propName)
    if (superSetter) {
      superSetter.call(instance, value)
    } else {
      instance[`${propName}➤pntr:appliedValue`] = value
    }
  }

  function getSuperGetter(propName) {
    let proto = BaseFacadeClass.prototype
    if (propName in proto) { //prefilter across entire proto chain
      while (proto) {
        let desc = Object.getOwnPropertyDescriptor(proto, propName)
        if (desc && desc.get) {
          return desc.get
        }
        proto = Object.getPrototypeOf(proto)
      }
    }
    return null
  }

  function getSuperSetter(propName) {
    let proto = BaseFacadeClass.prototype
    if (propName in proto) { //prefilter across entire proto chain
      while (proto) {
        let desc = Object.getOwnPropertyDescriptor(proto, propName)
        if (desc && desc.set) {
          return desc.set
        }
        proto = Object.getPrototypeOf(proto)
      }
    }
    return null
  }

  function hoverOverHandler(e) {
    e.currentTarget[isHoveringProp] = true
    afterPointerStateChange(e)
  }
  function hoverOutHandler(e) {
    e.currentTarget[isHoveringProp] = e.currentTarget[isActiveProp] = false
    afterPointerStateChange(e)
  }
  function activeDownHandler(e) {
    e.currentTarget[isActiveProp] = true
    afterPointerStateChange(e)
  }
  function activeUpHandler(e) {
    e.currentTarget[isActiveProp] = false
    afterPointerStateChange(e)
  }

  function afterPointerStateChange(e) {
    let highestFacade = e.currentTarget
    let parent = highestFacade.parent
    while (parent && parent.shouldUpdateChildren()) {
      if (parent.isPointerStateAware) {
        highestFacade = parent
      }
      parent = parent.parent
    }
    highestFacade.afterUpdate()
    highestFacade.notifyWorld('needsRender')
  }

  return PointerStatesAware
})
