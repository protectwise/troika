import WorldBaseFacade from '../WorldBase'
import Object2DFacade from './Object2D'
import HitTestContext from './HitTestContext'


class BackgroundFacade extends Object2DFacade {
  render(ctx) {
    if (this.color != null) {
      ctx.fillStyle = this.color
      ctx.fillRect(0, 0, this.width, this.height)
    }
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
    let pixelRatio = 1 //TODO window.pixelRatio

    // Clear canvas
    canvas.width = this.width * pixelRatio
    canvas.height = this.height * pixelRatio

    // Walk tree and render each Object2DFacade
    function visit(facade) {
      let isObject2D = facade.isObject2D
      if (isObject2D) {
        ctx.save()

        // update transform
        let mat = facade.transformMatrix
        ctx.transform(mat[0], mat[1], mat[2], mat[3], mat[4], mat[5])

        // render
        facade.beforeRender(ctx)
        facade.render(ctx)
      }

      // visit children, ordered by z
      let kids = []
      let hasDifferentZs = false
      facade.forEachChild(kid => {
        if (!hasDifferentZs && kids.length && kid.z !== kids[0].z) {
          hasDifferentZs = true
        }
        kids.push(kid)
      })
      if (hasDifferentZs) {
        kids.sort((a, b) => a.z - b.z)
      }
      kids.forEach(visit)

      if (isObject2D) {
        facade.afterRender(ctx)
        ctx.restore()
      }
    }
    visit(this)
  }


  /**
   * Implementation of abstract
   */
  getFacadesAtPosition(clientX, clientY, canvasRect) {
    let rect = this._element.getBoundingClientRect()
    let hits = null
    let currentFacade = null

    let ctx = new HitTestContext(clientX - rect.left, clientY - rect.top, () => {
      if (!hits) hits = Object.create(null)
      hits[currentFacade.$facadeId] = {
        facade: currentFacade,
        distance: -currentFacade.z //TODO handle group z
      }
    })

    function visit(facade) {
      let isObject2D = facade.isObject2D
      if (isObject2D) {
        currentFacade = facade
        ctx.save()

        // update transform
        let mat = facade.transformMatrix
        ctx.transform(mat[0], mat[1], mat[2], mat[3], mat[4], mat[5])

        // render
        facade.beforeRender(ctx)
        facade.render(ctx)
      }

      // visit children
      facade.forEachChild(visit)

      if (isObject2D) {
        facade.afterRender(ctx)
        ctx.restore()
      }
    }
    visit(this)

    return hits ? Object.keys(hits).map(id => hits[id]) : null
  }
}



export default World2DFacade
