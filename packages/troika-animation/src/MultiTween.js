import Tween from './Tween.js'


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
    if (tweens.length === 1) {
      this.callback = tweens[0].gotoElapsedTime.bind(tweens[0])
    } else {
      tweens.sort(endTimeComparator) //sort by end time to ensure proper iteration in syncTweens
      this.callback = this._syncTweens
    }
    this.tweens = tweens
  }

  _syncTweens(time) {
    // NOTE: forward iteration is important here so the tweens are evaluated in order
    // of when they end; that way later tweens will take precedence over earlier ones.
    // TODO would be nice to ignore tweens past their totalElapsed entirely, but have to
    // figure out how to do that while ensuring they don't get stuck with a value that is
    // slightly prior to their end state.
    for (let i = 0, len = this.tweens.length; i < len; i++) {
      this.tweens[i].gotoElapsedTime(time)
    }
  }
}

function endTimeComparator(a, b) {
  return a.totalElapsed - b.totalElapsed
}

export default MultiTween
