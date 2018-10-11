/**
 * Simple numeric interpolator function
 */
export function number(fromValue, toValue, progress) {
  return fromValue + (toValue - fromValue) * progress
}

/**
 * Interpolator for color values; decomposes the color into r/g/b channels and does
 * numeric interpolation on each individually. The result is a 24-bit integer value
 * holding the r/g/b channels in its 3 bytes.
 */
export function color(fromValue, toValue, progress) {
  fromValue = colorValueToNumber(fromValue)
  toValue = colorValueToNumber(toValue)
  return rgbToNumber(
    number(fromValue >> 16 & 255, toValue >> 16 & 255, progress),
    number(fromValue >> 8 & 255, toValue >> 8 & 255, progress),
    number(fromValue & 255, toValue & 255, progress)
  )
}



/**
 * Utility for converting one of the supported color value types to a 24-bit numeric color
 * representation.
 * @param {*} value - The input value to translate. Supported types:
 * - 24-bit number: simply returned as is
 * - string value: evaluated using a canvas context, so supports color keywords, rgb(), hsl(), etc.
 * - a three.js `Color` object
 * @return {*}
 */
const colorValueToNumber = (function() {
  let colorCanvas, colorCanvasCtx

  // Cache for evaluated string values
  let stringCache = Object.create(null)
  let stringCacheSize = 0
  const stringCacheMaxSize = 2048

  return function(value) {
    if (typeof value === 'number') {
      return value
    }
    else if (typeof value === 'string') {
      if (value in stringCache) {
        return stringCache[value]
      }

      // 2D canvas for evaluating string values
      if (!colorCanvas) {
        colorCanvas = document.createElement('canvas')
        colorCanvasCtx = colorCanvas.getContext('2d')
      }

      colorCanvas.width = colorCanvas.height = 1
      colorCanvasCtx.fillStyle = value
      colorCanvasCtx.fillRect(0, 0, 1, 1)
      const colorData = colorCanvasCtx.getImageData(0, 0, 1, 1).data
      const result = rgbToNumber(colorData[0], colorData[1], colorData[2])

      // Enforce max cache size - for now this invalidates the entire cache when reaching
      // the max size; we could use a true LRU cache but hitting the max size should be rare
      // in real world usage so this should suffice as a simple memory size protection.
      if (stringCacheSize > stringCacheMaxSize) {
        stringCache = Object.create(null)
        stringCacheSize = 0
      }

      // Put into cache
      stringCache[value] = result
      stringCacheSize++

      return result
    }
    else if (value && value.isColor) {
      return value.getHex()
    }
    else {
      return 0 //fallback to black
    }
  }
})()

function rgbToNumber(r, g, b) {
  return r << 16 ^ g << 8 ^ b
}
