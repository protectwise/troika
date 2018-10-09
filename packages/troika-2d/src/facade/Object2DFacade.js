import { PointerEventTarget } from 'troika-core'
import hitTestContext from '../HitTestContext'



function multiplyMatrices(a, b, target) {
  let a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3]
  let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5]
  target[0] = a0 * b0 + a2 * b1
  target[1] = a1 * b0 + a3 * b1
  target[2] = a0 * b2 + a2 * b3
  target[3] = a1 * b2 + a3 * b3
  target[4] = a0 * b4 + a2 * b5 + a[4]
  target[5] = a1 * b4 + a3 * b5 + a[5]
}

function copyMatrix(fromMat, toMat) {
  for (let i = 0; i < 6; i++) {
    toMat[i] = fromMat[i]
  }
}

let _worldMatrixVersion = 0



class Object2DFacade extends PointerEventTarget {
  constructor(parent) {
    super(parent)

    // Find nearest Object2DFacade ancestor and add direct parent/child
    // references. In addition to faster render tree traversal, maintaining
    // this separate tree allows exitAnimation to keep rendering instances
    // after removal from the facade tree.
    while (parent && !parent.isObject2D) {
      parent = parent.parent
    }
    if (parent) {
      parent._childObjects2D[this.$facadeId] = this
    }
    this._parentObject2DFacade = parent
    this._childObjects2D = Object.create(null)

    this.transformMatrix = [1, 0, 0, 1, 0, 0]
    this.worldTransformMatrix = [1, 0, 0, 1, 0, 0]
  }

  afterUpdate() {
    this.updateMatrices()
    super.afterUpdate()
  }

  /**
   * @template
   * Implement this to render this object's content into the given canvas 2d context.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
  }

  /**
   * Update this facade's `transformMatrix` and `worldTransformMatrix` to the current state if necessary.
   *
   * As long as this is called from the `afterUpdate` lifecycle method or later, it can be safely assumed that
   * the matrices of all ancestors have already been similarly updated so the result should always be accurate.
   *
   * @returns {Boolean} true if an update was performed
   */
  updateMatrices() {
    let parentObj2D = this._parentObject2DFacade
    let needsWorldMatrixUpdate
    if (this._matrixChanged) {
      this._updateLocalMatrix()
      this._matrixChanged = false
      needsWorldMatrixUpdate = true
    } else {
      needsWorldMatrixUpdate = parentObj2D && parentObj2D._worldMatrixVersion > this._worldMatrixVersion
    }
    if (needsWorldMatrixUpdate) {
      if (parentObj2D) {
        multiplyMatrices(parentObj2D.worldTransformMatrix, this.transformMatrix, this.worldTransformMatrix)
      } else {
        copyMatrix(this.transformMatrix, this.worldTransformMatrix)
      }

      this._worldMatrixVersion = ++_worldMatrixVersion
    }
  }

  _updateLocalMatrix() {
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
  }

  hitTest(x, y) {
    hitTestContext.startHitTesting(x, y)

    this.updateMatrices()
    let matrix = this.worldTransformMatrix
    hitTestContext.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5])

    // Render using hit testing context
    this.render(hitTestContext)

    return hitTestContext.didHit
  }

  getProjectedPosition(x=0, y=0) {
    this.updateMatrices()
    let matrix = this.worldTransformMatrix
    return {
      x: x === 0 ? matrix[4] : x * matrix[0] + y * matrix[2] + matrix[4],
      y: y === 0 ? matrix[5] : x * matrix[1] + y * matrix[3] + matrix[5]
    }
  }

  // Like forEachChild but only for the Object2D render tree - skips intermediates like Lists
  // and can include objects that have been removed but are still in their exitAnimation
  forEachChildObject2D(fn) {
    let kids = this._childObjects2D
    for (let id in kids) {
      fn(kids[id])
    }
  }

  destructor() {
    let parentObj2D = this._parentObject2DFacade
    if (parentObj2D) {
      delete parentObj2D._childObjects2D[this.$facadeId]
    }
    super.destructor()
  }
}

const proto = Object2DFacade.prototype
proto.isObject2D = true
proto.z = 0
proto._worldMatrixVersion = -1



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
