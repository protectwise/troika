import WorldBaseFacade from '../WorldBase'
import Object2DFacade from './Object2D'



function traverseInZOrder(facade, preCallback, postCallback) {
  preCallback && preCallback(facade)

  // visit children, ordered by z
  let kids = []
  let hasDifferentZs = false
  facade.forEachChild((kid, i) => {
    if (!hasDifferentZs && kids.length && kid.z !== kids[0].z) {
      hasDifferentZs = true
    }
    kids.push(kid)
  })
  if (hasDifferentZs) {
    for (let i = 0, len = kids.length; i < len; i++) {
      kids.$tmpIndexOf = i
    }
    kids.sort((a, b) => a.z - b.z || a.$tmpIndexOf - b.$tmpIndexOf)
  }
  for (let i = 0, len = kids.length; i < len; i++) {
    traverseInZOrder(kids[i], preCallback, postCallback)
  }

  postCallback && postCallback(facade)
}



class BackgroundFacade extends Object2DFacade {
  render(ctx) {
    if (this.color != null) {
      ctx.fillStyle = this.color
      ctx.fillRect(0, 0, this.width, this.height)
    }
  }

  hitTest(x, y) {
    return true //always hits, but at furthest possible distance
  }
}
BackgroundFacade.prototype.z = -Infinity



class World2DFacade extends WorldBaseFacade {
  constructor(canvas) {
    super(canvas)
    this._context = canvas.getContext('2d')
  }

  afterUpdate() {
    this.children = [{
      key: 'bg',
      class: BackgroundFacade,
      color: this.backgroundColor,
      width: this.width,
      height: this.height,
      onClick: this.onBackgroundClick
    }].concat(this.children)

    super.afterUpdate()
  }


  doRender() {
    let canvas = this._element
    let ctx = this._context
    let {width, height} = this
    let pixelRatio = window.devicePixelRatio

    // Clear canvas and set size/ratio
    canvas.width = width * pixelRatio
    canvas.height = height * pixelRatio
    if (width !== this._lastWidth || height !== this._lastHeight) {
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      this._lastWidth = width
      this._lastHeight = height
    }
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

    // Walk tree in z order and render each Object2DFacade
    traverseInZOrder(this, facade => {
      if (facade.isObject2D) {
        ctx.save()

        // update transform
        let mat = facade.transformMatrix
        ctx.transform(mat[0], mat[1], mat[2], mat[3], mat[4], mat[5])

        // render
        facade.beforeRender(ctx)
        facade.render(ctx)
      }
    }, facade => {
      if (facade.isObject2D) {
        facade.afterRender(ctx)
        ctx.restore()
      }
    })
  }


  /**
   * Implementation of abstract
   */
  getFacadesAtPosition(clientX, clientY, canvasRect) {
    let rect = this._element.getBoundingClientRect()
    let x = clientX - rect.left
    let y = clientY - rect.top
    let hits = null
    let distance = 0

    traverseInZOrder(this, facade => {
      if (facade.isObject2D && facade.hitTest(x, y)) {
        if (!hits) hits = Object.create(null)
        hits[facade.$facadeId] = {
          facade: facade,
          distance: distance-- //since iteration is in z order, we can just decrement for a logical distance
        }
      }
    })

    if (hits) {
      hits = Object.keys(hits).map(id => hits[id])
    }
    return hits
  }
}



export default World2DFacade
