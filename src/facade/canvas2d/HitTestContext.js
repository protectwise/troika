/**
 * hitTestContext
 *
 * This is a hidden CanvasRenderContext2D instance that has been overridden to track
 * whenever something is drawn at a given x/y coordinate. This can be used for testing
 * whether an Object2DFacade is under the mouse cursor, by passing this as the context
 * to its render() method.
 */

import {forOwn} from '../../utils'

const hitTestContext = document.createElement('canvas').getContext('2d')
hitTestContext.save()

/**
 * Start hit testing for the given x/y coordinate. The x/y should be relative to the canvas.
 * @param x
 * @param y
 */
hitTestContext.startHitTesting = function(x, y) {
  this._x = x
  this._y = y
  this.didHit = false
  this.restore()
  this.save()
}

forOwn({
  fill: 'Path',
  fillRect: 'Path',
  stroke: 'Stroke'
}, function(testType, paintMethod) {
  let testMethod = `isPointIn${testType}`
  hitTestContext[paintMethod] = function(...args) {
    if (this[testMethod](this._x, this._y)) {
      this.didHit = true
    }
  }
})

export default hitTestContext


