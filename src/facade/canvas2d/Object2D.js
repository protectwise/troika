import PointerEventTarget from '../PointerEventTarget'

const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0]


class Object2DFacade extends PointerEventTarget {
  constructor(parent) {
    super(parent)
    this.transformMatrix = new Float32Array(IDENTITY_MATRIX)
  }

  afterUpdate() {
    if (this._matrixChanged) {
      let mat = this.transformMatrix
      let {x, y, rotate, scaleX, scaleY} = this
      let cos = rotate === 0 ? 1 : Math.cos(rotate)
      let sin = rotate === 0 ? 0 : Math.sin(rotate)
      mat[0] = scaleX * cos
      mat[1] = scaleX * sin
      mat[2] = scaleY * -sin
      mat[3] = scaleY * cos
      mat[4] = x
      mat[5] = y
      this._matrixChanged = false
    }
    super.afterUpdate()
  }

  beforeRender(ctx) {
  }

  render(ctx) {
  }

  afterRender(ctx) {
  }
}

Object2DFacade.prototype.isObject2D = true


// Define props that affect the object's local transform matrix
function defineTransformProp(prop, defaultValue) {
  let privateProp = '➤' + prop
  Object.defineProperty(Object2DFacade.prototype, prop, {
    get() {
      return (privateProp in this) ? this[privateProp] : defaultValue
    },
    set(value) {
      let lastVal = this[privateProp]
      if (lastVal !== value) {
        this[privateProp] = value
        this._matrixChanged = true
      }
    }
  })
}
defineTransformProp('x', 0)
defineTransformProp('y', 0)
defineTransformProp('rotate', 0)
defineTransformProp('scaleX', 1)
defineTransformProp('scaleY', 1)


export default Object2DFacade
