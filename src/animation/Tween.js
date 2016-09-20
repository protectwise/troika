import easings from 'easingjs'


const linear = v => v


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
 */
class Tween {
  constructor(callback, fromValue, toValue, duration=750, delay=0, easing=linear, iterations=1, direction='forward') {
    this.callback = callback
    this.fromValue = fromValue
    this.toValue = toValue
    this.duration = duration
    this.delay = delay
    this.easing = typeof easing === 'string' ? (easings[easing] || linear) : easing
    this.iterations = iterations
    this.direction = direction
  }

  gotoTime(time) {
    let duration = this.duration
    let delay = this.delay
    if (time >= delay) {
      time = Math.min(time, this.getTotalDuration()) //never go past final value
      let progress = time - delay === 0 ? 0 : (time - delay) % duration === 0 ? 1 : ((time - delay) % duration) / duration
      progress = this.easing(progress)
      if (this.direction === 'reverse' || (this.direction === 'alternate' && Math.floor((time - delay) / duration) % 2 > 0)) {
        progress = 1 - progress
      }
      this.callback(this.interpolate(this.fromValue, this.toValue, progress))
    }
  }

  getTotalDuration() {
    return this.delay + (this.duration * this.iterations)
  }

  isDoneAtTime(time) {
    return time > this.getTotalDuration()
  }

  interpolate(fromValue, toValue, progress) {
    return this.fromValue + (this.toValue - this.fromValue) * progress
  }
}

export default Tween
