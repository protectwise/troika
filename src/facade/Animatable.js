import _ from 'lodash'
import Tween from '../animation/Tween'
import MultiTween from '../animation/MultiTween'
import Runner from '../animation/Runner'

const DEFAULT_DURATION = 750
const DEFAULT_EASING = 'easeOutCubic'
const transitionDescriptorKey = 'transition➤descriptor'
const animationDescriptorKey = 'animation➤descriptor'
const runnerKey = 'animation➤runner'
const animationTweensKey = 'animation➤tweens'
const animatingPropsKey = 'animation➤animatingProps'




export default function(WrappedClass) {
  class AnimatableWrapper extends WrappedClass {

    constructor(...args) {
      super(...args)

      // Create root runner for all this object's animation and transition tweens
      this[runnerKey] = new Runner()
      this[runnerKey].onTick = () => {
        this.afterUpdate()
        this.notify('needsRender')
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
     *       delay: n //in ms, defaults to 0
     *     }
     *   }
     */
    set transition(descriptor) {
      if (descriptor) {
        // Ensure setter/getter has been created for all props in transition
        for (let propName in descriptor) {
          if (descriptor.hasOwnProperty(propName)) {
            defineTransitionPropInterceptor(propName)
          }
        }
      }
      this[transitionDescriptorKey] = descriptor
    }
    get transition() {
      return this[transitionDescriptorKey]
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
     *     easing: 'linear', //easing for the whole animation, defaults to 'linear'
     *     iterations: 5, //number of times to loop the animation, defaults to 1. Set to Infinity for endless loop.
     *     direction: 'forward' //either 'forward', 'backward', or 'alternate'
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
      // Is the animation descriptor new or changed?
      if (!_.isEqual(descriptor, this[animationDescriptorKey])) {
        // Clear any existing animation state
        let runner = this[runnerKey]
        let animTweens = this[animationTweensKey]
        if (animTweens) {
          animTweens.forEach(runner.stop, runner)
          this[animTweens] = null
        }
        let animatingProps = null

        // Set up new animation if defined
        if (descriptor) {
          animatingProps = Object.create(null)

          let buildTweenForAnim = (animDesc) => {
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
                          // Collect list of properties being animated
                          animatingProps[animProp] = true
                          defineTransitionPropInterceptor(animProp)
                          // Stop any active transition tweens for this property
                          let tweenKey = animProp + '➤tween'
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
            // Sort the keyframes by time
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
                    keyframePropTweens.push(new Tween(
                      this[prop + '➤actuallySet'].bind(this), //callback
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
            return new MultiTween(keyframePropTweens, delay, easing, iterations, direction)
          }

          // Build and start a tween for each animation
          let animTweens = this[animationTweensKey] = _.isArray(descriptor) ? descriptor.map(buildTweenForAnim) : [buildTweenForAnim(descriptor)]
          animTweens.forEach(runner.start, runner)
        }

        this[animatingPropsKey] = animatingProps
      }
      this[animationDescriptorKey] = descriptor
    }
    get animation() {
      return this[animationDescriptorKey]
    }

    destructor() {
      this[runnerKey].destructor()
      super.destructor()
    }
  }

  // Add get/set interceptor to the wrapper's prototype if this is the first time seeing this prop. Putting it
  // on the wrapper prototype allows us to avoid per-instance overhead as well as avoid collisions with
  // other custom setters anywhere else in the prototype chain.
  function defineTransitionPropInterceptor(propName) {
    if (!AnimatableWrapper.prototype.hasOwnProperty(propName)) {
      let actualValueKey = `${ propName }➤actualValue`
      let actuallySetKey = `${ propName }➤actuallySet`
      let hasBeenSetKey = `${ propName }➤hasBeenSet`
      let activeTweenKey = `${ propName }➤tween`

      // Find the nearest getter/setter up the prototype chain, if one exists. Assuming the prototype won't change after the fact.
      let superGetter, superSetter
      let proto = WrappedClass.prototype
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
      Object.defineProperty(AnimatableWrapper.prototype, actuallySetKey, { value: actuallySet })


      // Add the custom getter/setter for this property
      Object.defineProperty(AnimatableWrapper.prototype, propName, {
        get() {
          // Always return the current actual value
          return superGetter ? superGetter.call(this) : this[actualValueKey]
        },

        set(value) {
          // Will this value be controlled by an animation? Ignore it since animations take precedence.
          if (this[animatingPropsKey] && this[animatingPropsKey][propName]) {
            return
          }

          // Does this value have a transition defined, and are the old/new values transitionable?
          let runner = this[runnerKey]
          let transition = this.transition
          if (transition && transition.hasOwnProperty(propName) && transition[propName] && this[hasBeenSetKey]
              && typeof value === 'number' && typeof this[propName] === 'number') { //TODO allow non-numeric value interpolation
            transition = transition[propName]
            // If there's no active transition tween, or the new value is different than the active tween's
            // target value, initiate a new transition tween. Otherwise ignore it.
            let tween = this[activeTweenKey]
            if (!tween || value !== tween.toValue) {
              if (tween) runner.stop(tween)
              tween = this[activeTweenKey] = new Tween(
                actuallySet.bind(this), //callback
                this[propName], //fromValue
                value, //toValue
                transition.duration || DEFAULT_DURATION, //duration
                transition.delay || 0, //delay
                transition.easing || DEFAULT_EASING //easing
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
  }

  return AnimatableWrapper
}
