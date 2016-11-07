import {Color} from 'three'

const fromColor = new Color()
const toColor = new Color()
const progressColor = new Color()

export function number(fromValue, toValue, progress) {
  return fromValue + (toValue - fromValue) * progress
}

export function color(fromValue, toValue, progress) {
  fromColor.set(fromValue)
  toColor.set(toValue)
  progressColor.setRGB(
    number(fromColor.r, toColor.r, progress),
    number(fromColor.g, toColor.g, progress),
    number(fromColor.b, toColor.b, progress)
  )
  return progressColor.getHex()
}
