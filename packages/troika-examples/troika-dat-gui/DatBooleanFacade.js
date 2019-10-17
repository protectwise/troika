import Icon from './MaterialIconFacade'

class DatBooleanFacade extends Icon {
  constructor(parent) {
    super(parent)
    // Material Icons font URL
    this.justifyContent = 'center'
    this.fontSize = '150%'
    this.onClick = e => {
      this.onUpdate(!this.value)
    }
  }

  afterUpdate () {
    this.icon = this.value ? 'check_box' : 'check_box_outline_blank'
    super.afterUpdate()
  }
}

export default DatBooleanFacade
