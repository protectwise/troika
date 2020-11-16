import PRESETS from './SpringPresets.js'
import AbstractTween from './AbstractTween.js'

// Factors to be applied to the tension and friction values; these match those used by
// react-spring internally, so that users can use the same spring configs as they would
// in react-spring.
const tensionFactor = 0.000001
const frictionFactor = 0.001

const DEFAULTS = PRESETS.default

/**
 * @class SpringTween
 * Represents a transition between two values based on spring physics.
 *
 * This is very similar to `Tween`, except that it does not have a fixed duration. Instead, it advances a simple
 * spring physics simulation on each call to `gotoElapsedTime`. Since it depends on being advanced in forward-time
 * order, it cannot be repeated or run in a reverse direction. It is also not usable as a member of a `MultiTween`.
 *
 * The `toValue` property can be modified at any time while the simulation is running, and the velocity will be
 * maintained; this makes spring tweens more useful than duration-based tweens for objects whose target values are
 * changed rapidly over time, e.g. drag-drop.
 *
 * Non-numeric interpolations are not yet supported.
 *
 * @param callback {Function} a function that will be called with the current tween value at a given point in time.
 * @param {number} fromValue - the beginning value
 * @param {number} toValue - the initial ending value; this can be modified later by setting the `toValue` property
 * @param {string|object} springConfig - the physical configuration of the spring physics simulation. Either an object
 *        with `mass`, `tension`, and `friction` properties, or a string corresponding to one of the presets defined
 *        in `SpringPresets.js`. Defaults to the "default" preset.
 * @param {number} springConfig.mass - the mass of the simulated object being moved
 * @param {number} springConfig.tension - the spring's tension constant accelerating the simulated object
 * @param {number} springConfig.friction - the friction force decelerating the simulated object
 * @param {number} [initialVelocity] - velocity of the object at the start of the simulation
 * @param {number} [delay] optional time in milliseconds to wait before starting the simulation
 */
class SpringTween extends AbstractTween {
  constructor (
    callback,
    fromValue,
    toValue,
    springConfig,
    initialVelocity = 0,
    delay = 0
  ) {
    super()
    this.isSpring = true
    this.callback = callback
    this.currentValue = fromValue
    this.toValue = toValue
    this.velocity = initialVelocity
    this.delay = delay

    if (typeof springConfig === 'string') {
      springConfig = PRESETS[springConfig]
    }
    if (!springConfig) springConfig = DEFAULTS
    const {mass, tension, friction} = springConfig
    this.mass = typeof mass === 'number' ? mass : DEFAULTS.mass
    this.tension = (typeof tension === 'number' ? tension : DEFAULTS.tension) * tensionFactor
    this.friction = (typeof friction === 'number' ? friction : DEFAULTS.friction) * frictionFactor
    this.minAcceleration = 1e-10 // in units/ms^2 - TODO make this configurable

    this.$lastTime = delay
    this.$endTime = Infinity //unknown until simulation is stepped to the end state
  }

  gotoElapsedTime (time) {
    if (time >= this.delay) {
      let { toValue, mass, tension, friction, minAcceleration } = this
      let velocity = this.velocity || 0
      let value = this.currentValue

      // Step simulation by 1ms
      for (let t = this.$lastTime; t < time; t++) {
        const acceleration = (tension * (toValue - value) - friction * velocity) / mass
        // Acceleration converges to zero near end state
        if (Math.abs(acceleration) < minAcceleration) {
          velocity = 0
          value = toValue
          this.$endTime = t
          break
        } else {
          velocity += acceleration
          value += velocity
        }
      }
      this.velocity = velocity
      this.$lastTime = time
      this.callback(this.currentValue = value)
    }
  }

  gotoEnd () {
    this.velocity = 0
    this.$lastTime = this.$endTime
    this.callback(this.currentValue = this.toValue)
  }

  isDoneAtElapsedTime (time) {
    return time >= this.$endTime
  }
}

export default SpringTween
