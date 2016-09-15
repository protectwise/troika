import TweenBase from './TweenBase'

class MultiTween extends TweenBase {
  constructor(tweens, ...playbackArgs) {
    // Find duration based on the longest individual total duration
    let longestDuration = tweens.reduce((dur, tween) => Math.max(dur, tween.getTotalDuration()), 0)
    if (longestDuration === Infinity) {
      // Make an infinite duration finite, so easing math still works
      longestDuration = Number.MAX_VALUE
    }
    super(longestDuration, ...playbackArgs)
    this.tweens = tweens
  }

  gotoProgress(progress) {
    let tweens = this.tweens
    for (let i = 0, len = tweens.length; i < len; i++) {
      tweens[i].gotoTime(progress * this.duration)
    }
  }
}

export default MultiTween
