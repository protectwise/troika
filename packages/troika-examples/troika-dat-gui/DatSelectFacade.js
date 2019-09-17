import { ListFacade } from 'troika-core'
import { UIBlock3DFacade } from 'troika-3d-ui'
import Icon from './MaterialIconFacade'

const sceneCloserEvents = ['mousedown', 'wheel']


class DatSelectFacade extends UIBlock3DFacade {
  constructor(parent) {
    super(parent)
    this.position = 'relative'

    this._onItemClick = e => {
      this.onUpdate(e.target.value)
      this._closeMenu()
    }

    this._openMenu = () => {
      if (!this._menuOpen) {
        this._menuOpen = true
        this.afterUpdate()
        let scene = this.getSceneFacade()
        if (scene) {
          sceneCloserEvents.forEach(type => {
            scene.addEventListener(type, this._closeMenu)
          })
        }
      }
    }

    this._closeMenu = e => {
      if (this._menuOpen && (!e || !isEventInFacade(e, this))) {
        this._menuOpen = false
        this.afterUpdate()
        let scene = this.getSceneFacade()
        if (scene) {
          sceneCloserEvents.forEach(type => {
            scene.removeEventListener(type, this._closeMenu)
          })
        }
      }
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
        onClick: this._openMenu,
        children: [
          '', //label
          {
            facade: Icon,
            icon: 'keyboard_arrow_down'
          }
        ]
      },
      null //slot for menu child
    ]

    this._menuChild = {
      key: 'menu',
      facade: UIBlock3DFacade,
      debugMe: true,
      position: 'absolute',
      top: '100%',
      left: 0,
      width: '100%',
      backgroundColor: 0x333333,
      z: 0.001,
      //rotateX: Math.PI / -24,
      maxHeight: 0.5,
      overflow: 'scroll',
      flexDirection: 'column',
      children: {
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
        duration: 500,
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

    if (this._menuOpen) {
      const menu = this._menuChild
      menu.children.data = options
      this.children[1] = menu
    } else {
      this.children[1] = null
    }

    super.afterUpdate()
  }

  destructor () {
    this._closeMenu(null)
    super.destructor()
  }
}

function isEventInFacade(e, facade) {
  let tgt = e.target
  while (tgt) {
    if (tgt === facade) return true
    tgt = tgt.parent
  }
  return false
}

export default DatSelectFacade
