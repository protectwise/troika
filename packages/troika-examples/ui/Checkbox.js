import {UIBlock3DFacade} from 'troika-3d-ui'
import MaterialIconFacade from './MaterialIconFacade'

export default class Checkbox extends UIBlock3DFacade {
  constructor(parent) {
    super(parent)

    this.flexDirection = 'row'

    // TODO needs support in Yoga's JS bindings for setBaselineFunction: https://github.com/facebook/yoga/issues/591
    // this.alignItems = 'baseline'

    this.children = [
      this._iconDef = {
        key: 'icon',
        facade: MaterialIconFacade,
        margin: [0, 5, 0, 0]
      },
      this._labelDef = {
        key: 'label',
        facade: UIBlock3DFacade
      }
    ]
  }
  afterUpdate() {
    this._iconDef.icon = this.checked ? 'check_box' : 'check_box_outline_blank'
    this._labelDef.text = this.label
    super.afterUpdate()
  }
}