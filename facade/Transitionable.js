import TweenLite from 'gsap/src/uncompressed/TweenLite'


function findSuperSetter(WrappedClass, propName) {
  let proto = WrappedClass.prototype
  while (proto) {
    let desc = Object.getOwnPropertyDescriptor(proto, propName)
    if (desc && desc.set) {
      return desc.set
    }
    proto = Object.getPrototypeOf(proto) //walk up the proto chain
  }
}


export default function(WrappedClass) {
  class TransitionableWrapper extends WrappedClass {

    constructor(...args) {
      super(...args)

      /* Container for state related to transitions. Per-prop state is stored flat via namespaced keys:
       {
         "height.target": 100, //target value
         "height.current": 32.5, //current intermediary value
         "height.tween": {} //tween object while active
       }
       */
      this.$transitionState = Object.create(null)
    }

    /**
     * Handle the special "transition" property. The descriptor should be an object with
     * transitionable property names as keys and transition parameters as values. The
     * transition parameters can either be `true` for a default transition, or an object
     * of the form:
     *
     *   transition: {
     *     width: true, //uses default parameters
     *     height: {
     *       duration: n, //in ms, defaults to 750
     *       ease: e, //easing function, defaults to Power2.easeOut
     *       delay: n //in ms, defaults to 0
     *     }
     *   }
     */
    set transition(descriptor) {
      this.$transitionDef = descriptor
      if (descriptor) {
        for (let propName in descriptor) {
          if (descriptor.hasOwnProperty(propName)) {
            definePropInterceptor(this, propName)
          }
        }
      }
    }

    destructor() {
      let txState = this.$transitionState
      for (let key in txState) {
        if (txState[key] && /\.tween$/.test(key)) {
          txState[key].kill()
        }
      }
      delete this.$transitionState
      super.destructor()
    }
  }

  // Add get/set interceptor to the wrapper's prototype if this is the first time seeing this prop. Putting it
  // on the wrapper prototype allows us to avoid per-instance overhead as well as avoid collisions with
  // other custom setters anywhere else in the prototype chain.
  function definePropInterceptor(instance, propName) {
    if (!TransitionableWrapper.prototype.hasOwnProperty(propName)) {
      let currentKey = propName + '.current'
      let targetKey = propName + '.target'
      let tweenKey = propName + '.tween'

      // Find the nearest setter up the prototype chain, if one exists. Assuming it won't change after the fact.
      let superSetter = findSuperSetter(WrappedClass, propName)

      // Add the getter/setter for this property
      Object.defineProperty(TransitionableWrapper.prototype, propName, {
        get() {
          // Always return the current actual value
          return this.$transitionState[currentKey]
        },

        set(value) {
          let txState = this.$transitionState
          if (value !== txState[targetKey]) {
            txState[targetKey] = value

            // Kill any existing tweens
            let tween = txState[tweenKey]
            if (tween) tween.kill()

            // If current transition descriptor defines a tween and there's a previous value, start a tween
            let txDef = this.$transitionDef && this.$transitionDef[propName]
            if (txDef && txState[currentKey] != null) {
              tween = TweenLite.to(txState, (txDef.duration || 750) / 1000, {
                [currentKey]: value,
                delay: (txDef.delay || 0) / 1000,
                ease: txDef.ease || window.Power2.easeOut,
                onUpdate: () => {
                  if (superSetter) {
                    superSetter.call(this, txState[currentKey])
                  }
                  this.afterUpdate()
                  this.notify('needsRender')
                }
              })
            }
            // Not starting a tween; set directly to end state
            else {
              tween = null
              txState[currentKey] = value
              if (superSetter) {
                superSetter.call(this, value)
              }
            }
            txState[tweenKey] = tween
          }
        }

      })
    }
  }

  TransitionableWrapper.$isTransitionableForClass = WrappedClass

  return TransitionableWrapper
}
