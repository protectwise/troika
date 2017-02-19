import PointerEventTarget from '../PointerEventTarget'
import hitTestContext from './HitTestContext'

const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0]
const reusableArray = []


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

  hitTest(x, y) {
    hitTestContext.startHitTesting(x, y)

    reusableArray.length = 0
    let obj = this
    while (obj) {
      if (obj.transformMatrix) {
        reusableArray.push(obj.transformMatrix)
      }
      obj = obj.parent
    }
    for (let i = reusableArray.length; i--;) {
      let mat = reusableArray[i]
      hitTestContext.transform(mat[0], mat[1], mat[2], mat[3], mat[4], mat[5])
    }

    this.beforeRender(hitTestContext)
    this.render(hitTestContext)
    this.afterRender(hitTestContext)

    return hitTestContext.didHit
  }
}

const proto = Object2DFacade.prototype
proto.isObject2D = true
proto.z = 0


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
