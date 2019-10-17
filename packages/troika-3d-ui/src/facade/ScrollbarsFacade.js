import { Object3DFacade, ParentFacade } from 'troika-3d'
import { CylinderBufferGeometry, Mesh, MeshBasicMaterial } from 'three'

let barGeometry


class ScrollbarBarFacade extends Object3DFacade {
  constructor(parent) {
    const mesh = new Mesh(
      barGeometry || (barGeometry =
        new CylinderBufferGeometry(0.5, 0.5, 1, 8).translate(0, -0.5, 0)
      ),
      // TODO allow overriding material
      new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0
      })
    )
    super(parent, mesh)
    this.girth = 0
    this.length = 0
  }

  afterUpdate () {
    this.scaleX = this.scaleZ = this.girth
    this.scaleY = this.length
    this.rotateZ = this.horizontal ? Math.PI / 2 : 0
    this.threeObject.material.opacity = this.opacity
    super.afterUpdate()
  }
}

const targets = new WeakMap()

const opacityTransition = {
  opacity: {duration: 300}
}

class ScrollbarsFacade extends ParentFacade {
  constructor(parent) {
    super(parent)
    this._onOver = e => {
      this.hovering = true
      this.afterUpdate()
    }
    this._onOut = e => {
      this.hovering = false
      this.afterUpdate()
    }
  }

  set target(target) {
    const oldTarget = targets.get(this)
    if (target !== oldTarget) {
      if (oldTarget) {
        oldTarget.removeEventListener('mouseover', this._onOver)
        oldTarget.removeEventListener('mouseout', this._onOut)
      }
      if (target) {
        target.addEventListener('mouseover', this._onOver)
        target.addEventListener('mouseout', this._onOut)
      }
      targets.set(this, target)
    }
  }
  get target() {
    return targets.get(this)
  }

  afterUpdate () {
    const {target} = this
    const children = this.children || (this.children = [])
    children.length = 0
    if (target) {
      const {
        offsetWidth,
        offsetHeight,
        scrollHeight,
        scrollWidth,
        clientWidth,
        clientHeight
      } = target
      const fontSize = target.getComputedFontSize()

      if (scrollWidth > clientWidth) {
        const hScrollbar = this._hDef || (this._hDef = {
          key: 'h',
          facade: ScrollbarBarFacade,
          horizontal: true,
          transition: opacityTransition
        })
        hScrollbar.girth = Math.min( fontSize / 4, offsetHeight / 10)
        hScrollbar.length = Math.max(clientWidth * clientWidth / scrollWidth, fontSize)
        hScrollbar.x = target.clientLeft + (clientWidth - hScrollbar.length) * (target.scrollLeft / (scrollWidth - clientWidth))
        hScrollbar.y = -offsetHeight
        hScrollbar.opacity = this.hovering ? 0.5 : 0
        hScrollbar.renderOrder = this.renderOrder
        children.push(hScrollbar)
      }
      if (scrollHeight > clientHeight) {
        const vScrollbar = this._vDef || (this._vDef = {
          key: 'v',
          facade: ScrollbarBarFacade,
          transition: opacityTransition
        })
        vScrollbar.girth = Math.min( fontSize / 4, offsetWidth / 10)
        vScrollbar.length = Math.max(clientHeight * clientHeight / scrollHeight, fontSize)
        vScrollbar.x = offsetWidth
        vScrollbar.y = -(target.clientTop + (clientHeight - vScrollbar.length) * (target.scrollTop / (scrollHeight - clientHeight)))
        vScrollbar.opacity = this.hovering ? 0.5 : 0
        vScrollbar.renderOrder = this.renderOrder
        children.push(vScrollbar)
      }
    }
    super.afterUpdate()
  }

  destructor () {
    this.target = null
    super.destructor()
  }
}

export default ScrollbarsFacade
