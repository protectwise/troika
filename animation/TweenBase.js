import easings from 'easingjs'


const linear = v => v

class TweenBase {
  constructor(duration=750, delay=0, easing=linear, iterations=1, direction='forward') {
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
      this.gotoProgress(progress)
      if (this.onUpdate) {
        this.onUpdate(time)
      }
    }
  }

  gotoProgress(progress) {
    // abstract
  }

  getTotalDuration() {
    return this.delay + (this.duration * this.iterations)
  }

  isDoneAtTime(time) {
    return time > this.getTotalDuration()
  }
}

export default TweenBase
