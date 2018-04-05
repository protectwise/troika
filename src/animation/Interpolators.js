import {Color} from 'three'

const fromColor = new Color()
const toColor = new Color()
const progressColor = new Color()

export function number(fromValue, toValue, progress) {
  return fromValue + (toValue - fromValue) * progress
}

export function color(fromValue, toValue, progress) {
  setColor(fromColor, fromValue)
  setColor(toColor, toValue)
  progressColor.setRGB(
    number(fromColor.r, toColor.r, progress),
    number(fromColor.g, toColor.g, progress),
    number(fromColor.b, toColor.b, progress)
  )
  return progressColor.getHex()
}

function setColor(colorObj, value) {
  if (value && value.isColor) {
    colorObj.copy( value )
  } else if (typeof value === 'number') {
    colorObj.setHex( value )
  } else if (typeof value === 'string') {
    colorObj.setStyle( value )
  } else {
    colorObj.setHex(0xffffff)
  }
}
