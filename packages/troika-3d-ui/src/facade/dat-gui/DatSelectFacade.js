import { ListFacade } from 'troika-core'
import UIBlock3DFacade from '../UIBlock3DFacade.js'
import Icon from '../widgets/MaterialIconFacade.js'
import PopupOwner from './PopupOwner'


class DatSelectFacade extends PopupOwner {
  constructor(parent) {
    super(parent)
    this.position = 'relative'

    this._onItemClick = e => {
      this.onUpdate(e.target.value)
      this.closePopup()
    }

    this.children = [
      this._btnChild = {
        key: 'btn',
        facade: UIBlock3DFacade,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: '10%',
        backgroundColor: 0x333399,
        height: '100%',
        padding: [0, 0.02],
        overflow: 'hidden',
        pointerStates: {
          hover: {
            backgroundColor: 0x6666cc
          }
        },
        onClick: this.openPopup,
        children: [
          '', //label
          {
            facade: Icon,
            icon: 'keyboard_arrow_down'
          }
        ]
      }
    ]

    // Content definition for menu when open
    this.popupContent = {
      key: 'menu',
      facade: UIBlock3DFacade,
      position: 'absolute',
      top: '100%',
      left: 0,
      width: '100%',
      backgroundColor: 0x333333,
      z: 0.01,
      //rotateX: Math.PI / -90,
      maxHeight: 0.5,
      overflow: 'scroll',
      flexDirection: 'column',
      children: this._menuListDef = {
        facade: ListFacade,
        data: null, //populated by `options` property
        template: {
          key: (d, i) => i,
          facade: UIBlock3DFacade,
          width: '100%',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          padding: 0.01,
          text: d => d.label,
          value: d => d.value,
          onClick: d => this._onItemClick,
          backgroundColor: d => d.selected ? 0x666666 : null,
          pointerStates: {
            hover: {
              backgroundColor: 0x444444
            }
          }
        }
      },
      animation: {
        from: {scale: 0.01},
        to: {scale: 1},
        duration: 300,
        easing: 'easeOutExpo'
      },
      // exitAnimation: {
      //   from: {scale: 1},
      //   to: {scale: 0.01},
      //   duration: 200
      // }
    }
  }

  afterUpdate () {
    let currentOption = null
    const options = this.options.reduce((out, d) => {
      if (d) {
        const opt = {}
        if (d && typeof d === 'object') {
          opt.value = d.value
          opt.label = typeof d.label === 'string' ? d.label : `${d.value}`
        }
        else {
          opt.value = d
          opt.label = d + ''
        }
        if (opt.value === this.value) {
          opt.selected = true
          currentOption = opt
        }
        out.push(opt)
      }
      return out
    }, [])

    this._btnChild.children[0] = currentOption ? currentOption.label : '[Select...]'

    this._menuListDef.data = options

    super.afterUpdate()
  }
}

export default DatSelectFacade
