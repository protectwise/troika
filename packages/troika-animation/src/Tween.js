import * as Easings from './Easings.js'
import * as Interpolators from './Interpolators.js'

const linear = v => v
const maxSafeInteger = 0x1fffffffffffff

/**
 * @class Tween
 * Represents a transition between two values across a duration of time.
 *
 * Typically you will create a Tween between two values, with a callback function to handle the intermediate values,
 * and then start the Tween in a {@link Runner} which will start invoking the tween on each animation frame until
 * it reaches the end of its duration.
 *
 * @param callback {Function} a function that will be called with the current tween value at a given point in time.
 * @param fromValue {*} the beginning value
 * @param toValue {*} the ending value
 * @param duration {Number} the duration of the tween in milliseconds
 * @param [delay] {Number} optional time in milliseconds to wait before starting the tween
 * @param [easing] {Function|String} optional easing to be applied to the tween values. Can either be a function
 *        that takes a value from 0 to 1 and returns a corresponding "eased" value, or a string that matches the
 *        name of one of the common Penner easing functions - see http://easings.net/ Defaults to linear easing.
 * @param [iterations] {Number} optional number of times to repeat the tween animation. For endless repeating,
 *        specify `Infinity`.
 * @param [direction] {String} direction to run the tween; one of 'forward', 'reverse', or 'alternate'. For
 *        'alternate', it will toggle between forward and reverse on each iteration.
 * @param [interpolate] {String|Function} how tweened values should be calculated between the fromValue and toValue.
 *        Can be the string name for one of the built-in interpolators in Interpolators.js, or a custom function that
 *        will be passed 3 arguments: `fromValue`, `toValue`, and `progress` from 0 to 1.
 */
class Tween {
  constructor(callback, fromValue, toValue, duration=750, delay=0, easing=linear, iterations=1, direction='forward', interpolate='number') {
    this.callback = callback
    this.fromValue = fromValue
    this.toValue = toValue
    this.duration = duration
    this.delay = delay
    this.easing = typeof easing === 'string' ? (Easings[easing] || linear) : easing
    this.iterations = iterations
    this.direction = direction
    this.interpolate = typeof interpolate === 'function' ? interpolate : Interpolators[interpolate] || Interpolators.number

    /**
     * @property totalElapsed
     * @type {number}
     * The total duration of this tween from 0 to its completion, taking into account its `duration`, `delay`, and
     * `iterations`. This is calculated once upon instantiation, and may be used to determine whether the tween is
     * finished or not at a given time.
     */
    this.totalElapsed = this.iterations < maxSafeInteger ? this.delay + (this.duration * this.iterations) : maxSafeInteger
  }

  /**
   * For a given elapsed time relative to the start of the tween, calculates the value at that time and calls the
   * `callback` function with that value. If the given time is during the `delay` period, the callback will not be
   * invoked.
   * @param {number} time
   */
  gotoElapsedTime(time) {
    let duration = this.duration
    let delay = this.delay
    if (time >= delay) {
      time = Math.min(time, this.totalElapsed) - delay //never go past final value
      let progress = (time % duration) / duration
      if (progress === 0 && time !== 0) progress = 1
      progress = this.easing(progress)
      if (this.direction === 'reverse' || (this.direction === 'alternate' && Math.ceil(time / duration) % 2 === 0)) {
        progress = 1 - progress
      }
      this.callback(this.interpolate(this.fromValue, this.toValue, progress))
    }
  }

  /**
   * Like `gotoElapsedTime` but goes to the very end of the tween.
   */
  gotoEnd() {
    this.gotoElapsedTime(this.totalElapsed)
  }
}

export default Tween
