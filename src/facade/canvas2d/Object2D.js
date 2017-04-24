import PointerEventTarget from '../PointerEventTarget'
import hitTestContext from './HitTestContext'

const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0]



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


function doUpdateWorldMatrix(facade) {
  if (facade.isObject2D) {
    let parentFacade = facade.parentObject2D
    if (parentFacade) {
      multiplyMatrices(parentFacade.worldTransformMatrix, facade.transformMatrix, facade.worldTransformMatrix)
    } else {
      facade.worldTransformMatrix.set(facade.transformMatrix)
    }
  }
}

function callUpdateWorldMatrix(facade) {
  facade.updateWorldMatrix()
}



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
    this.parentObject2D = parent
    this._childObjects2D = Object.create(null)

    this.transformMatrix = new Float32Array(IDENTITY_MATRIX)
    this.worldTransformMatrix = new Float32Array(IDENTITY_MATRIX)
  }

  afterUpdate() {
    this.updateLocalMatrix()
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

  updateLocalMatrix() {
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
      this._worldMatrixChanged = true
    }
  }

  // Conditionally syncs worldTransformMatrix for this and all child facades if needed.
  // Should be called from the topmost level
  updateWorldMatrix() {
    if (this._worldMatrixChanged) {
      // Force update of the world matrix for this and all descendants as they may be affected
      this.traverse(doUpdateWorldMatrix)
      this._worldMatrixChanged = false
    } else {
      // Check all children
      this.forEachChildObject2D(callUpdateWorldMatrix)
    }
  }

  hitTest(x, y) {
    hitTestContext.startHitTesting(x, y)

    // Assume world matrix is up to date
    let matrix = this.worldTransformMatrix
    hitTestContext.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5])

    // Render using hit testing context
    this.render(hitTestContext)

    return hitTestContext.didHit
  }

  getUserSpaceXY() {
    // Assume world matrix is up to date
    let matrix = this.worldTransformMatrix
    return {
      x: matrix[4],
      y: matrix[5]
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
    let parentObj2D = this.parentObject2D
    if (parentObj2D) {
      delete parentObj2D._childObjects2D[this.$facadeId]
    }
    super.destructor()
  }
}

const proto = Object2DFacade.prototype
proto.isObject2D = true
proto.z = 0
proto._worldMatrixChanged = true


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
