import UIBlock3DFacade from '../UIBlock3DFacade.js'

class SliderFacade extends UIBlock3DFacade {
  constructor (parent) {
    super(parent)

    // this.value = 0
    // this.min = 0
    // this.max = 1
    // this.step = 0.1

    this.flexDirection = 'row'
    this.minHeight = 0.01
    this.backgroundColor = 0x666666
    this.children = this._valChild = {
      key: 'slider',
      facade: UIBlock3DFacade,
      backgroundColor: 0xffffff,
      width: '0%'
    }

    this.onMouseDown = this.onDragStart = this.onDrag = e => {
      const min = this.min || 0
      const max = this.max || 0
      if (max !== min && e.intersection && e.intersection.facade === this) {
        let val = min + e.intersection.uv.x * (max - min)
        const step = this.step || 0.001 //TODO choose a step based on min/max?
        val = Math.round(val / step) * step
        val = +val.toFixed((step + '').replace(/^-?\d+\.?/, '').length) //trim precision errors
        this.onChange(val)
        e.stopPropagation()
      }
    }
  }

  afterUpdate () {
    const valChild = this._valChild
    //valChild.backgroundColor = this.color == null ? 0xffffff : this.color

    const val = this.value || 0
    const min = Math.min(this.min || 0, val)
    const max = Math.max(this.max || 0, val)
    valChild.width = min === max ? 0 : `${(val - min) / (max - min) * 100}%`

    super.afterUpdate()
  }
}

export default SliderFacade
