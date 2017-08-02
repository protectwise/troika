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
    this.callback = tweens.length === 1 ? tweens[0].gotoElapsedTime.bind(tweens[0]) : this.syncTweens.bind(this)
    this.tweens = tweens
  }

  syncTweens(time) {
    for (let i = this.tweens.length; i-- > 0;) {
      this.tweens[i].gotoElapsedTime(time)
    }
  }
}

export default MultiTween
