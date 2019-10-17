import { utils } from 'troika-core'
import { UIBlock3DFacade } from 'troika-3d-ui'
import objectPath from 'object-path'

import DatBooleanFacade from './DatBooleanFacade'
import DatButtonFacade from './DatButtonFacade'
import DatColorFacade from './DatColorFacade'
// import DatFolderFacade from './DatFolderFacade'
import DatNumberFacade from './DatNumberFacade'
// import DatPresetsFacade from './DatPresetsFacade'
import DatSelectFacade from './DatSelectFacade'
// import DatStringFacade from './DatStringFacade'

const TYPE_FACADES = {
  boolean: DatBooleanFacade,
  button: DatButtonFacade,
  color: DatColorFacade,
  // folder: DatFolderFacade,
  number: DatNumberFacade,
  // presets: DatPresetsFacade,
  select: DatSelectFacade,
  // string: DatStringFacade
}


class DatGuiFacade extends UIBlock3DFacade {
  constructor(parent) {
    super(parent)

    this.flexDirection = 'row'
    this.fontSize = 0.02
    this.itemHeight = 0.04
    this.padding = [0, 0.02]
    this.backgroundColor = 0x444444
    this.borderRadius = 0.01
    this.alignItems = 'flex-start'

    this.data = {}
    this._onItemUpdate = (path, value) => {
      objectPath.set(this.data, path, value)
      this.onUpdate(this.data)
    }
  }

  afterUpdate () {
    this.children = [
      // Labels
      {
        facade: UIBlock3DFacade,
        flexDirection: 'column',
        margin: [0, 0.03, 0, 0],
        children: (this.items || []).map((item, i) => {
          return item ? {
            facade: UIBlock3DFacade,
            text: item.type === 'button' ? null : item.label || item.path,
            height: item.height || this.itemHeight,
            margin: [i ? 0 : 0.02, 0, 0.02],
            flexDirection: 'row',
            alignItems: 'center'
          } : null
        })
      },
      // Values
      {
        facade: UIBlock3DFacade,
        flexDirection: 'column',
        minWidth: 0.2,
        children: (this.items || []).map((item, i) => {
          if (!item) return null
          const facade = item && TYPE_FACADES[item.type]
          return facade ?
            utils.assign({
              key: item.path || i,
              facade,
              height: item.height || this.itemHeight,
              margin: [i ? 0 : 0.02, 0, 0.02],
              value: objectPath.get(this.data, item.path),
              onUpdate: this._onItemUpdate.bind(this, item.path)
            }, item) :
            {
              facade: UIBlock3DFacade,
              text: `Unknown Type: ${item.type}`
            }
        })
      }
    ]

    super.afterUpdate()
  }
}


export default DatGuiFacade
