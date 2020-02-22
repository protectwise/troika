import { ParentFacade } from 'troika-core'
import UIBlock3DFacade from '../UIBlock3DFacade.js'

const sceneCloserEvents = ['mousedown', 'wheel']


class PopupOwner extends UIBlock3DFacade {
  constructor(parent) {
    super(parent)

    this.popupContent = null
    this._popupCt = {key: 'popup', facade: ParentFacade}

    this._onCloserEvent = e => {
      if (!isEventInFacade(e, this)) {
        this.closePopup()
      }
    }

    this.openPopup = () => {
      if (!this.isPopupOpen) {
        this.isPopupOpen = true
        this.afterUpdate()
      }
    }

    this.closePopup = () => {
      if (this.isPopupOpen) {
        this.isPopupOpen = false
        this.afterUpdate()
      }
    }

  }

  getPopupContent() {
    return this.popupContent
  }

  set children(children) {
    this._children = [this._popupCt].concat(children)
  }
  get children() {
    return this._children
  }

  _toggleCloseListeners(on) {
    const scene = this.getSceneFacade()
    if (scene) {
      sceneCloserEvents.forEach(type => {
        scene[(on ? 'add' : 'remove') + 'EventListener'](type, this._onCloserEvent)
      })
    }
  }

  afterUpdate () {
    const {isPopupOpen} = this
    if (isPopupOpen !== this._wasPopupOpen) {
      this._wasPopupOpen = isPopupOpen
      this._toggleCloseListeners(isPopupOpen)
    }
    this._popupCt.children = isPopupOpen ? this.getPopupContent() : null
    super.afterUpdate()
  }

  destructor () {
    this._toggleCloseListeners(false)
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

export default PopupOwner
