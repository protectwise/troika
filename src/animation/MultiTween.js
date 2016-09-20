import Tween from './Tween'


/**
 * A specialized Tween that controls one or more other tweens. The controlled tweens are treated as a
 * single unit and the easing/iterations/etc. are applied across the total duration of all tweens.
 */
class MultiTween extends Tween {
  constructor(tweens, delay, easing, iterations, direction) {
    // Calculate duration based on the longest individual total duration
    let longestDuration = tweens.reduce((dur, tween) => Math.max(dur, tween.getTotalDuration()), 0)
    if (longestDuration === Infinity) {
      // Make an infinite duration finite, so easing math still works
      longestDuration = Number.MAX_VALUE
    }

    // Tween the total duration time
    super(val => this.syncTweens(val), 0, longestDuration, longestDuration, delay, easing, iterations, direction)

    this.tweens = tweens
  }

  syncTweens(time) {
    let tweens = this.tweens
    for (let i = 0, len = tweens.length; i < len; i++) {
      tweens[i].gotoTime(time)
    }
  }
}

export default MultiTween
