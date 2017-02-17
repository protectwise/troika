/**
 * HitTestContext
 *
 * This is an object that has the same exact shape as a CanvasRenderContext2D, but
 * has special hooks that fire a callback whenever an object is drawn at a given x/y
 * coordinate. This allows us to use a HitTestContext as the context object in the
 * standard render pass and be notified which objects are under the mouse pointer.
 */


// A real context to back our fake one
const CTX = document.createElement('canvas').getContext('2d')


class HitTestContext {
  constructor(x, y, onHit) {
    this.x = x
    this.y = y
    this.onHit = onHit
  }

  fill(...args) {
    CTX.fill(...args)
    if (CTX.isPointInPath(this.x, this.y)) {
      this.onHit()
    }
  }

  fillRect(...args) {
    CTX.fillRect(...args)
    if (CTX.isPointInPath(this.x, this.y)) {
      this.onHit()
    }
  }

  stroke(...args) {
    CTX.stroke(...args)
    if (CTX.isPointInStroke(this.x, this.y)) {
      this.onHit()
    }
  }

  // TODO fillText...?
}


// For any CanvasRenderContext2D methods/properties that weren't overridden
// above, proxy them to the real context instance
const ctxProto = CanvasRenderingContext2D.prototype
for (let key in ctxProto) {
  if (!HitTestContext.prototype[key]) {
    let descriptor = Object.getOwnPropertyDescriptor(ctxProto, key)
    // methods
    if (typeof descriptor.value === 'function') {
      HitTestContext.prototype[key] = function(...args) {
        CTX[key](...args)
      }
    }
    // properties
    else {
      Object.defineProperty(HitTestContext.prototype, key, {
        get() {
          return CTX[key]
        },
        set(val) {
          CTX[key] = val
        }
      })
    }
  }
}


export default HitTestContext

