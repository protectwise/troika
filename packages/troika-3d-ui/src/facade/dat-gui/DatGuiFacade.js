import { utils } from 'troika-core'
import UIBlock3DFacade from '../UIBlock3DFacade.js'
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

/**
 * @typedef {object} DatGuiItemDefinition
 * @property {('boolean'|'button'|'color'|'number'|'select')} type - The datatype of this value item.
 * @property {string} path - A string defining where in the `data` object this item's value lives.
 * @property {string} [label] - A label for the item. Defaults to the `path`.
 * @property {number} [height] - A custom height for this item
 * @property {function} [onUpdate] - A function that will be called when the item's value changes, in
 *           addition to the main `DatGuiFacade`'s onUpdate function.
 * Additional properties can also be added and will be passed down to their implementation facade.
 */

/**
 * THIS IS A WORK-IN-PROGRESS.
 *
 * `DatGuiFacade` creates a UI panel for tweaking a set of values, along the lines of
 * the well-known [dat.GUI](https://workshop.chromeexperiments.com/examples/gui) or
 * [react-dat-gui]([react-dat-gui](https://github.com/claus/react-dat-gui), for use within
 * WebGL environments. This is particularly useful in WebXR, where overlaid HTML cannot be
 * used. It is interactable via both screen mouse/touch input and WebXR pointer inputs.
 *
 * @member {DatGuiItemDefinition[]} items - Defines the list of values to be presented.
 * @member {object} data - An object containing the current values for each of the `items`.
 * @member {function(object)} onUpdate - A function that gets called when the user changes any
 *         values. It is passed the modified `data` object.
 * @member {number} [itemHeight] - Default height for the items.
 *
 * This extends {@link UIBlock3DFacade} so any of its supported properties can also be set.
 */
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
  }

  _onItemUpdate(item, value) {
    objectPath.set(this.data, item.path, value)
    this.onUpdate(this.data)
  }

  describeChildren () {
    return [
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
              value: objectPath.get(this.data, item.path)
            }, item, {
              onUpdate: (value) => {
                if (item.onUpdate) {
                  item.onUpdate.call(item, value)
                }
                this._onItemUpdate(item, value)
              }
            }) :
            {
              facade: UIBlock3DFacade,
              text: `Unknown Type: ${item.type}`
            }
        })
      }
    ]
  }
}

export {DatGuiFacade}
