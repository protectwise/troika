import { WorldBaseFacade } from 'troika-core'
import Object2DFacade from './Object2DFacade'

function byZ(a, b) {
  return a.z - b.z
}

function traverseInZOrder(facade, callback) {
  callback && callback(facade)

  // visit children, ordered by z
  let kids = []
  let hasDifferentZs = false
  facade.forEachChildObject2D((kid) => {
    if (!hasDifferentZs && kids.length && kid.z !== kids[0].z) {
      hasDifferentZs = true
    }
    kids.push(kid)
  })
  if (hasDifferentZs) {
    // TODO secondary sort by tree order?
    kids.sort(byZ)
  }
  for (let i = 0, len = kids.length; i < len; i++) {
    traverseInZOrder(kids[i], callback)
  }
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
    this._onBgClick = this._onBgClick.bind(this)
  }

  afterUpdate() {
    this.children = {
      key: 'bg',
      facade: BackgroundFacade,
      color: this.backgroundColor,
      width: this.width,
      height: this.height,
      onClick: this.onBackgroundClick ? this._onBgClick : null,
      children: this.objects
    }

    super.afterUpdate()
  }


  doRender() {
    let canvas = this._element
    let ctx = this._context
    let {width, height} = this
    let pixelRatio = this.pixelRatio || window.devicePixelRatio || 1

    // Clear canvas and set size
    canvas.width = width * pixelRatio
    canvas.height = height * pixelRatio

    // Set root pixel ratio transform
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

    // Walk tree in z order and render each Object2DFacade
    let root = this.getChildByKey('bg')
    traverseInZOrder(root, facade => {
      ctx.save()

      // update transform
      let mat = facade.worldTransformMatrix
      ctx.transform(mat[0], mat[1], mat[2], mat[3], mat[4], mat[5])

      // render
      facade.render(ctx)

      ctx.restore()
    })
  }


  /**
   * Implementation of abstract
   */
  getFacadeUserSpaceXYZ(facade) {
    let {x, y} = facade.getProjectedPosition(0, 0)
    let z = facade.z
    return {
      x: x,
      y: y,
      z: z > 1 ? 1 / z : 1 - z //always non-negative, larger numbers closer to camera
      //TODO honor cascaded z
    }
  }

  /**
   * @override Implementation of abstract
   * @return {Array<{facade, distance, ?distanceBias, ...}>|null}
   */
  getFacadesAtEvent(e, filterFn) {
    const canvasRect = e.target.getBoundingClientRect() //e.target is the canvas
    let x = e.clientX - canvasRect.left
    let y = e.clientY - canvasRect.top
    let hits = null
    let distance = 0

    traverseInZOrder(this.getChildByKey('bg'), facade => {
      if ((!filterFn || filterFn(facade)) && facade.hitTest(x, y)) {
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

  _onBgClick(e) {
    // Ignore clicks that bubbled up
    if (e.target === e.currentTarget) {
      this.onBackgroundClick(e)
    }
  }
}



export default World2DFacade
