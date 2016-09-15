import _ from 'lodash'
import PropertyTween from '../animation/PropertyTween'
import MultiTween from '../animation/MultiTween'
import {start as startTween, stop as stopTween} from '../animation/Runner'

const DEFAULT_DURATION = 750
const DEFAULT_EASE = 'easeOutCubic'


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
  class AnimatableWrapper extends WrappedClass {

    constructor(...args) {
      super(...args)

      /* Container for state related to transitions. Per-prop transition state is stored flat via namespaced keys.
       {
         "height.current": 32.5, //current value applied by transition or animation
         "height.transitionTarget": 100, //target value for a property transition
         "height.transitionTween": {} //tween object for a property transition
         "animatingProps": {} //list of props currently being controlled by an active animation
         "animationTween": {} //master tween for active animations
       }
       */
      this.$animationState = Object.create(null)
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
      if (descriptor) {
        // Ensure setter/getter has been created for all props in transition
        for (let propName in descriptor) {
          if (descriptor.hasOwnProperty(propName)) {
            defineTransitionPropInterceptor(this, propName)
          }
        }
      }
      this.$transitionDef = descriptor
    }


    /**
     * Handle the special "animation" property. The descriptor should be an object or array
     * of objects defining a set of keyframes and their playback parameters. Keyframes are
     * defined by numeric keys from 0 to 100, each defining an object with the target
     * property values for that keyframe.
     *
     *   animation: [{
     *     0: {rotateZ: 0}, //can also use key "from"
     *     100: {rotateZ: Math.PI * 2}, //can also use key "to"
     *     delay: 0, //starting delay in ms
     *     duration: 2000, //total anim duration in ms, defaults to 750
     *     ease: 'linear', //easing for the whole animation, defaults to 'linear'
     *     iterations: 5, //number of times to loop the animation, defaults to 1. Set to Infinity for endless loop.
     *     direction: 'forward' //either 'forward', 'backward', or 'alternate'
     *   }, ...]
     *
     * Internally the animations will be built into a set of nested tweens:
     *
     * |--------------------------- Main MultiTween ------------------------------------|
     * |------------- Anim 1 MultiTween w/ easing+repeat ----------------|
     * |--- prop1 tween 1 ---|--- prop1 tween 2 ---|--- prop1 tween 3 ---|
     * |--------- prop2 tween 1 --------|--------- prop2 tween 2 --------|
     *                             |-------- Anim 2 MultiTween w/ easing+repeat --------|
     *                             |----- prop3 tween 1 -----|----- prop3 tween 2 ------|
     */
    set animation(descriptor) {
      if (!_.isEqual(descriptor, this.$animationDef)) {
        // Kill any existing master tween
        let animationState = this.$animationState
        if (animationState.animationTween) {
          stopTween(animationState.animationTween)
          animationState.animationTween = null
          animationState.animatingProps = null
        }

        if (descriptor) {
          animationState.animatingProps = Object.create(null)

          let buildTweenForAnim = (animDesc) => {
            let delay = 0
            let duration = DEFAULT_DURATION
            let ease = 'linear'
            let iterations = 1
            let keyframes = []
            let direction = 'forward'

            for (let prop in animDesc) {
              if (animDesc.hasOwnProperty(prop)) {
                switch(prop) {
                  case 'duration':
                    duration = animDesc[prop]; break
                  case 'delay':
                    delay = animDesc[prop]; break
                  case 'ease':
                    ease = animDesc[prop]; break
                  case 'iterations':
                    iterations = animDesc[prop]; break
                  case 'direction':
                    direction = animDesc[prop]; break
                  default:
                    let percent = prop === 'from' ? 0 : prop === 'to' ? 100 : parseFloat(prop)
                    if (!isNaN(percent) && percent >= 0 && percent <= 100) {
                      keyframes.push({time: percent / 100, props: animDesc[prop]})
                      for (let animProp in animDesc[prop]) {
                        if (animDesc[prop].hasOwnProperty(animProp)) {
                          animationState.animatingProps[animProp] = true
                        }
                      }
                    }
                }
              }
            }
            keyframes.sort((a, b) => a.time - b.time)
            if (keyframes[0].time > 0) {
              keyframes.unshift(_.defaults({time: 0}, keyframes[0]))
            }

            // Build a MultiTween with tweens for each keyframe+property
            let keyframePropTweens = []
            for (let i = 1, len = keyframes.length; i < len; i++) {
              let keyframe = keyframes[i]
              let props = keyframe.props
              for (let prop in props) {
                if (props.hasOwnProperty(prop)) {
                  let prevKeyframe = null
                  for (let j = i; j--;) {
                    if (prop in keyframes[j].props) {
                      prevKeyframe = keyframes[j]
                      break
                    }
                  }
                  if (prevKeyframe) {
                    keyframePropTweens.push(new PropertyTween(
                      this, //target
                      prop, //propertyName
                      prevKeyframe.props[prop], //fromValue
                      props[prop], //toValue
                      (keyframe.time - prevKeyframe.time) * duration, //duration
                      prevKeyframe.time * duration, //delay
                      'linear' //easing
                    ))
                  }
                }
              }
            }
            return new MultiTween(keyframePropTweens, delay, ease, iterations, direction)
          }
          let animTweens = _.isArray(descriptor) ? descriptor.map(buildTweenForAnim) : [buildTweenForAnim(descriptor)]

          // Stop any active transition tweens for properties the new animation will control
          for (let prop in animationState.animatingProps) {
            let tweenKey = prop + '.tween'
            if (animationState[tweenKey]) {
              stopTween(animationState[tweenKey])
              animationState[tweenKey] = null
            }
          }

          // Wrap all individual animations in a master MultiTween to handle overall lifecycle
          let mainTween = new MultiTween(animTweens)
          mainTween.onUpdate = () => {
            this.afterUpdate()
            this.notify('needsRender')
          }
          mainTween.onDone = () => {
            delete animationState.animationTween
            delete animationState.animatingProps
          }
          startTween(mainTween)

          animationState.animationTween = mainTween
        }
      }
      this.$animationDef = descriptor
    }

    destructor() {
      let animState = this.$animationState
      for (let key in animState) {
        if (animState[key] && /\.tween$/.test(key)) {
          stopTween(animState[key])
        }
        if (animState.animationTween) {
          stopTween(animState.animationTween)
        }
      }
      delete this.$animationState
      super.destructor()
    }
  }

  // Add get/set interceptor to the wrapper's prototype if this is the first time seeing this prop. Putting it
  // on the wrapper prototype allows us to avoid per-instance overhead as well as avoid collisions with
  // other custom setters anywhere else in the prototype chain.
  function defineTransitionPropInterceptor(instance, propName) {
    if (!AnimatableWrapper.prototype.hasOwnProperty(propName)) {
      let currentKey = propName + '.current'
      let targetKey = propName + '.target'
      let tweenKey = propName + '.tween'

      // Find the nearest setter up the prototype chain, if one exists. Assuming it won't change after the fact.
      let superSetter = findSuperSetter(WrappedClass, propName)

      // Add the getter/setter for this property
      Object.defineProperty(AnimatableWrapper.prototype, propName, {
        get() {
          // Always return the current actual value
          return this.$animationState[currentKey]
        },

        set(value) {
          let animState = this.$animationState
          if (value !== animState[targetKey]) {
            animState[targetKey] = value

            // Kill any existing tweens
            let tween = animState[tweenKey]
            if (tween) stopTween(tween)

            // If current transition descriptor defines a tween and there's a previous value, and
            // it's not being controlled by an `animation`, start a new transition tween
            let txDef = this.$transitionDef && this.$transitionDef[propName]
            if (txDef && animState[currentKey] != null && !(animState.animatingProps && propName in animState.animatingProps)) {
              tween = new PropertyTween(
                animState, //target
                currentKey, //propertyName
                animState[currentKey], //fromValue
                value, //toValue
                txDef.duration || DEFAULT_DURATION, //duration
                txDef.delay || 0, //delay
                txDef.ease || DEFAULT_EASE //easing
              )
              tween.onUpdate = () => {
                if (superSetter) {
                  superSetter.call(this, animState[currentKey])
                }
                this.afterUpdate()
                this.notify('needsRender')
              }
              tween.onDone = () => {
                animState[tweenKey] = null
              }
              startTween(tween)
            }
            // Not starting a tween; set directly to end state
            else {
              tween = null
              animState[currentKey] = value
              if (superSetter) {
                superSetter.call(this, value)
              }
            }
            animState[tweenKey] = tween
          }
        }

      })
    }
  }

  return AnimatableWrapper
}
