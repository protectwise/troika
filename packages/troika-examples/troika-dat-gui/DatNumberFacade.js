import { UIBlock3DFacade } from 'troika-3d-ui'
import SliderFacade from './SliderFacade'


class DatNumberFacade extends UIBlock3DFacade {
  constructor(parent) {
    super(parent)

    this.value = 0
    this.min = 0
    this.max = 1
    this.step = 0.1

    this.flexDirection = 'row'
    this.alignItems = 'center'
    this.children = [
      this._sliderChild = {
        key: 'slider',
        facade: SliderFacade,
        flex: 1,
        minWidth: 0.2,
        height: '100%',
        margin: [0, 0.01, 0, 0]
        // value/min/max/step set in afterUpdate
      },
      this._textChild = {
        key: 'text',
        facade: UIBlock3DFacade,
        width: 0.05,
        text: '0' //set in afterUpdate
      }
    ]
  }

  afterUpdate () {
    this._textChild.text = this.value + ''

    const slider = this._sliderChild
    slider.value = this.value || 0
    slider.min = this.min || 0
    slider.max = this.max || 0
    slider.step = this.step
    slider.onChange = this.onUpdate

    super.afterUpdate()
  }
}

export default DatNumberFacade
