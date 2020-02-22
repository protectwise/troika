import UIBlock3DFacade from '../UIBlock3DFacade.js'
import ColorPickerFacade from '../widgets/ColorPickerFacade.js'
import { Color } from 'three'
import PopupOwner from './PopupOwner'

const tempColor = new Color()

class DatButtonFacade extends PopupOwner {
  constructor (parent) {
    super(parent)
    this.flexDirection = 'row'
    this.alignItems = 'center'

    this.children = [
      this.swatchDef = {
        facade: UIBlock3DFacade,
        borderRadius: '10%',
        backgroundColor: null,
        height: '100%',
        width: '25%',
        onClick: this.openPopup
      },
      this.labelDef = {
        facade: UIBlock3DFacade,
        padding: 0.01
      }
    ]

    this.popupContent = this.pickerDef = {
      key: 'picker',
      facade: ColorPickerFacade,
      visible: false,
      onChange: this._onColorChange.bind(this),
      animation: {
        from: {scale: 1e-10},
        to: {scale: 1}, //overwritten in afterUpdate
        duration: 500,
        easing: 'easeOutExpo'
      }
    }
  }

  _onColorChange(newVal) {
    this.onUpdate(newVal)
  }

  afterUpdate () {
    const {swatchDef, labelDef, pickerDef, value, offsetWidth, offsetHeight} = this

    const hasColor = value != null
    if (hasColor) {
      tempColor.set(value)
    }

    swatchDef.backgroundColor = hasColor ? tempColor.getHex() : null
    labelDef.text = hasColor ? '#' + tempColor.getHexString().toUpperCase() : '(choose color)'

    if (offsetWidth && offsetHeight) {
      pickerDef.visible = true
      pickerDef.value = tempColor.getHex()
      const scale = offsetHeight * 7 //base scale on height
      pickerDef.scale = pickerDef.animation.to.scale = scale
      pickerDef.x = offsetWidth + scale * .75
      pickerDef.y = -scale / 2 - offsetHeight
      //pickerDef.z = scale / 2
    }

    super.afterUpdate()
  }
}

export default DatButtonFacade
