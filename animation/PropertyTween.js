import TweenBase from './TweenBase'

class PropertyTween extends TweenBase {
  constructor(target, property, fromValue, toValue, duration, ...playbackArgs) {
    super(duration, ...playbackArgs)
    this.target = target
    this.property = property
    this.fromValue = fromValue
    this.toValue = toValue
  }

  gotoProgress(progress) {
    this.target[this.property] = this.interpolate(this.fromValue, this.toValue, progress)
  }

  interpolate(fromValue, toValue, progress) {
    return this.fromValue + (this.toValue - this.fromValue) * progress
  }
}

export default PropertyTween
