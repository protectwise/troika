import { assignIf, createClassExtender } from '../utils.js'
import { Tween, MultiTween, Runner } from 'troika-animation'

const DEFAULT_DURATION = 750
const DEFAULT_EASING = 'easeOutCubic'

const TEMP_ARRAY = [null]

function animationIdJsonReplacer(key, value) {
  return key === 'paused' ? undefined : value === Infinity ? 'Infinity' : value
}

function compareByTime(a, b) {
  return a.time - b.time
}

export const extendAsAnimatable = createClassExtender('animatable', function(BaseFacadeClass) {
  class AnimatableFacade extends BaseFacadeClass {

    constructor(...args) {
      super(...args)

      // Create root runner for all this object's animation and transition tweens
      this.animation$runner = new Runner()
      this.animation$runner.onTick = () => {
        this.afterUpdate()
        this.notifyWorld('needsRender')
      }
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
     *       easing: e, //easing function, defaults to 'easeOutCubic'
     *       delay: n, //in ms, defaults to 0
     *       interpolate: 'number' //one of the named functions in Interpolators.js ('number', 'color', etc.) or a custom Function
     *     }
     *   }
     */
    set transition(descriptor) {
      if (descriptor) {
        // Ensure setter/getter has been created for all props in transition
        for (let propName in descriptor) {
          if (descriptor.hasOwnProperty(propName)) {
            defineTransitionPropInterceptor(propName, this)
          }
        }
      }
      this.transition$descriptor = descriptor
    }
    get transition() {
      return this.transition$descriptor
    }


    /**
     * Handle the special "animation" property. The descriptor should be an object or array
     * of objects defining a set of keyframes and their playback parameters. Keyframes are
     * defined by numeric keys from 0 to 100, each defining an object with the target
     * property values for that keyframe.
     *
     *   animation: [{
     *     0: {rotateZ: 0, color: 0x000000}, //can also use key "from"
     *     100: {rotateZ: Math.PI * 2, color: 0xffffff}, //can also use key "to"
     *     delay: 0, //starting delay in ms
     *     duration: 2000, //total anim duration in ms, defaults to 750
     *     easing: 'linear', //easing for the whole animation, defaults to 'linear'
     *     iterations: 5, //number of times to loop the animation, defaults to 1. Set to Infinity for endless loop.
     *     direction: 'forward', //either 'forward', 'backward', or 'alternate'
     *     interpolate: {color: 'color'}, //mapping of property names to Interpolators.js names or custom functions
     *     paused: false //if true the animation will be paused at its current position until set back to false
     *   }, ...]
     *
     * Internally the animations will be built into a set of nested tweens:
     *
     * |--------------------------- Main MultiTween ------------------------------------|
     *
     * |------------- Anim 1 MultiTween w/ easing+repeat ----------------|
     * |--- prop1 tween 1 ---|--- prop1 tween 2 ---|--- prop1 tween 3 ---|
     * |--------- prop2 tween 1 --------|--------- prop2 tween 2 --------|
     *
     *                    delay -->|-------- Anim 2 MultiTween w/ easing+repeat --------|
     *                             |----- prop3 tween 1 -----|----- prop3 tween 2 ------|
     *                             |------------------- prop4 tween --------------------|
     *                                            |----------- prop5 tween -------------|
     */
    set animation(descriptor) {
      if (this.animation$descriptor === descriptor) return
      this.animation$descriptor = descriptor
      let oldAnimTweens = this.animation$tweens || null
      let newAnimTweens = this.animation$tweens = descriptor ? Object.create(null) : null
      let runner = this.animation$runner
      let hasChanged = false

      // Handle single object not wrapped in array
      if (descriptor && !Array.isArray(descriptor)) {
        TEMP_ARRAY[0] = descriptor
        descriptor = TEMP_ARRAY
      }

      if (descriptor) {
        for (let i = 0, len = descriptor.length; i < len; i++) {
          let animDesc = descriptor[i]
          if (!animDesc) continue

          // Calculate an identifier for this animation based on properties whose modification requires a new tween
          let animId = JSON.stringify(animDesc, animationIdJsonReplacer)
          //console.log(`${animId} - is ${oldAnimTweens && oldAnimTweens[animId] ? '' : 'not'} in old tweens`)

          // If a matching tween already exists, update it
          if (oldAnimTweens && (animId in oldAnimTweens)) {
            let tween = oldAnimTweens[animId]
            if (animDesc.paused) {
              runner.pause(tween)
            } else {
              runner.start(tween)
            }
            newAnimTweens[animId] = tween
          }
          // Otherwise create a new tween
          else {
            let delay = 0
            let duration = DEFAULT_DURATION
            let easing = 'linear'
            let iterations = 1
            let keyframes = []
            let direction = 'forward'

            for (let key in animDesc) {
              if (animDesc.hasOwnProperty(key)) {
                switch(key) {
                  case 'duration':
                    duration = animDesc[key]; break
                  case 'delay':
                    delay = animDesc[key]; break
                  case 'easing':
                    easing = animDesc[key]; break
                  case 'iterations':
                    iterations = animDesc[key]; break
                  case 'direction':
                    direction = animDesc[key]; break
                  default:
                    let percent = key === 'from' ? 0 : key === 'to' ? 100 : parseFloat(key)
                    if (!isNaN(percent) && percent >= 0 && percent <= 100) {
                      keyframes.push({time: percent / 100, props: animDesc[key]})
                      for (let animProp in animDesc[key]) {
                        if (animDesc[key].hasOwnProperty(animProp)) {
                          // Ensure setter is in place
                          defineTransitionPropInterceptor(animProp, this)
                          // Stop any active transition tweens for this property
                          let tweenKey = animProp + '➤anim:tween'
                          if (this[tweenKey]) {
                            runner.stop(this[tweenKey])
                            this[tweenKey] = null
                          }
                        }
                      }
                    }
                }
              }
            }

            if (keyframes.length) {
              // Sort the keyframes by time
              keyframes.sort(compareByTime)
              if (keyframes[0].time > 0) {
                keyframes.unshift(assignIf({time: 0}, keyframes[0]))
              }

              // Build a MultiTween with tweens for each keyframe+property
              let keyframePropTweens = []
              for (let j = 1, len = keyframes.length; j < len; j++) {
                let keyframe = keyframes[j]
                let props = keyframe.props
                for (let prop in props) {
                  if (props.hasOwnProperty(prop)) {
                    let prevKeyframe = null
                    for (let k = j; k--;) {
                      if (prop in keyframes[k].props) {
                        prevKeyframe = keyframes[k]
                        break
                      }
                    }
                    if (prevKeyframe) {
                      let propTween = new Tween(
                        this[prop + '➤anim:actuallySet'].bind(this), //callback
                        prevKeyframe.props[prop], //fromValue
                        props[prop], //toValue
                        (keyframe.time - prevKeyframe.time) * duration, //duration
                        prevKeyframe.time * duration, //delay
                        'linear', //easing
                        1, //iterations
                        'forward', //direction
                        animDesc.interpolate && animDesc.interpolate[prop] || 'number'
                      )
                      propTween.$$property = prop
                      keyframePropTweens.push(propTween)
                    }
                  }
                }
              }
              let tween = newAnimTweens[animId] = new MultiTween(keyframePropTweens, duration, delay, easing, iterations, direction)
              if (!animDesc.paused) {
                runner.start(tween)
              }

              // The tween runner won't do anything until next tick, so immediately sync to the first frame's
              // properties if the animation has no delay to avoid a flash of bad initial state
              if (delay === 0) {
                let firstKeyframeProps = keyframes[0].props
                for (let prop in firstKeyframeProps) {
                  if (firstKeyframeProps.hasOwnProperty(prop)) {
                    this[prop + '➤anim:actuallySet'](firstKeyframeProps[prop])
                  }
                }
              }
            }

            hasChanged = true
          }
        }
      }

      // Stop any obsolete tweens
      if (oldAnimTweens) {
        for (let animId in oldAnimTweens) {
          if (!newAnimTweens || !newAnimTweens[animId]) {
            let tween = oldAnimTweens[animId]
            tween.gotoEnd() //force to end value so it doesn't stick partway through
            runner.stop(tween)
            hasChanged = true
          }
        }
      }

      // If the total set of animations has changed, recalc the set of animating properties
      if (hasChanged) {
        if (newAnimTweens) {
          let animatingProps = this.animation$animatingProps = Object.create(null)
          for (let animId in newAnimTweens) {
            let propTweens = newAnimTweens[animId].tweens
            for (let i = propTweens.length; i--;) {
              animatingProps[propTweens[i].$$property] = true
            }
          }
        } else {
          this.animation$animatingProps = null
        }
      }
    }
    get animation() {
      return this.animation$descriptor
    }

    destructor() {
      const runner = this.animation$runner
      if (this.exitAnimation && !this.parent.isDestroying) {
        runner.stopAll()
        this.animation = this.exitAnimation
        this.exitAnimation = this.transition = null
        const onTick = runner.onTick
        runner.onTick = () => {
          if (this.parent && !this.parent.isDestroying) {
            onTick()
          } else {
            // An ancestor may have been destroyed during our exit animation, orphaning this object;
            // catch this case and short-circuit the animation to prevent errors in subsequent ticks
            runner.onDone = null
            this.destructor()
          }
        }
        runner.onDone = () => {
          this.notifyWorld('needsRender')
          this.destructor()
        }
      } else {
        runner.destructor()
        super.destructor()
      }
    }
  }

  // Add get/set interceptor to the wrapper's prototype if this is the first time seeing this prop. Putting it
  // on the wrapper prototype allows us to avoid per-instance overhead as well as avoid collisions with
  // other custom setters anywhere else in the prototype chain.
  function defineTransitionPropInterceptor(propName, currentInstance) {
    if (!AnimatableFacade.prototype.hasOwnProperty(propName)) {
      let actualValueKey = `${ propName }➤anim:actualValue`
      let actuallySetKey = `${ propName }➤anim:actuallySet`
      let hasBeenSetKey = `${ propName }➤anim:hasBeenSet`
      let activeTweenKey = `${ propName }➤anim:tween`

      // Find the nearest getter/setter up the prototype chain, if one exists. Assuming the prototype won't change after the fact.
      let superGetter, superSetter
      let proto = BaseFacadeClass.prototype
      while (proto) {
        let desc = Object.getOwnPropertyDescriptor(proto, propName)
        if (desc) {
          superSetter = desc.set
          superGetter = desc.get
          if (superSetter && !superGetter || superGetter && !superSetter) {
            throw new Error(`Animatable: property ${propName} has a custom ${superSetter ? 'setter' : 'getter'} but no ${superSetter ? 'getter' : 'setter'}. Animatable properties must have both.`)
          }
          break
        }
        proto = Object.getPrototypeOf(proto)
      }

      // Function to set the value, bypassing the interceptor setter.
      // Use the super setter if available, otherwise store in a private-ish key
      let actuallySet = superSetter ? function actuallySet(value) {
        superSetter.call(this, value)
        if (!this[hasBeenSetKey]) {
          this[hasBeenSetKey] = true
        }
      } : function actuallySet(value) {
        this[actualValueKey] = value
        if (!this[hasBeenSetKey]) {
          this[hasBeenSetKey] = true
        }
      }
      Object.defineProperty(AnimatableFacade.prototype, actuallySetKey, { value: actuallySet })


      // Add the custom getter/setter for this property
      Object.defineProperty(AnimatableFacade.prototype, propName, {
        get() {
          // Always return the current actual value
          return superGetter ? superGetter.call(this) : this[hasBeenSetKey] ? this[actualValueKey] : BaseFacadeClass.prototype[propName]
        },

        set(value) {
          // Will this value be controlled by an animation? Ignore it since animations take precedence.
          if (this.animation$animatingProps && this.animation$animatingProps[propName]) {
            return
          }

          // Does this value have a transition defined, and are the old/new values transitionable?
          let runner = this.animation$runner
          let transition = this.transition
          if (transition && transition[propName] && this[hasBeenSetKey] && transition.hasOwnProperty(propName)) {
            transition = transition[propName]
            // If there's no active transition tween, or the new value is different than the active tween's
            // target value, initiate a new transition tween. Otherwise ignore it.
            let tween = this[activeTweenKey]
            let needsNewTween = false
            if (tween) {
              // Active tween - start new one if new value is different than the old tween's target value
              if (value !== tween.toValue) {
                runner.stop(tween)
                needsNewTween = true
              }
            } else if (value !== this[propName]) {
              // No active tween - only start one if the value is changing
              needsNewTween = true
            }
            if (needsNewTween) {
              tween = this[activeTweenKey] = new Tween(
                actuallySet.bind(this), //callback
                this[propName], //fromValue
                value, //toValue
                transition.duration || DEFAULT_DURATION, //duration
                transition.delay || 0, //delay
                transition.easing || DEFAULT_EASING, //easing
                1, //iterations
                'forward', //direction
                transition.interpolate || 'number' //interpolate
              )
              runner.start(tween)
            }
            return
          }

          // No animation or transition will be started; set the value.
          actuallySet.call(this, value)

          // Clean up obsolete stuff
          let tween = this[activeTweenKey]
          if (tween) runner.stop(tween)
          this[activeTweenKey] = null
        }
      })
    }


    // If the instance had this property set before the intercepting setter was added to the
    // prototype, that would continue to take precedence, so move its value to the private property.
    if (currentInstance.hasOwnProperty(propName)) {
      currentInstance[`${ propName }➤anim:actualValue`] = currentInstance[propName]
      currentInstance[`${ propName }➤anim:hasBeenSet`] = true
      delete currentInstance[propName]
    }

  }

  return AnimatableFacade
})
