import Tween from './Tween'


/**
 * A specialized Tween that controls one or more other tweens. The controlled tweens are treated as a
 * single unit and the easing/iterations/etc. are applied across the total duration of all tweens.
 */
class MultiTween extends Tween {
  constructor(tweens, duration, delay, easing, iterations, direction) {
    if (typeof duration !== 'number') {
      // Calculate duration based on the longest individual total duration
      duration = tweens.reduce((dur, tween) => Math.max(dur, tween.totalElapsed), 0)
    }
    if (duration === Infinity) {
      // Make an infinite duration finite, so easing math still works
      duration = Number.MAX_VALUE
    }

    // Tween the total duration time
    super(null, 0, duration, duration, delay, easing, iterations, direction)
    this.callback = this.syncTweens.bind(this)
    this.tweens = tweens
  }

  syncTweens(time) {
    let tweens = this.tweens
    for (let i = 0, len = tweens.length; i < len; i++) {
      tweens[i].gotoElapsedTime(time)
    }
  }
}

export default MultiTween
