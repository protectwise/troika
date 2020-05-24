import { Object3DFacade } from 'troika-3d'
import { TextMesh } from '../three/TextMesh.js'
import SelectionManagerFacade from './SelectionManagerFacade.js'

// Properties that will simply be forwarded to the TextMesh:
const TEXT_MESH_PROPS = [
  'text',
  'anchorX',
  'anchorY',
  'font',
  'fontSize',
  'letterSpacing',
  'lineHeight',
  'maxWidth',
  'overflowWrap',
  'textAlign',
  'whiteSpace',
  'material',
  'color',
  'colorRanges',
  'depthOffset',
  'clipRect',
  'orientation',
  'debugSDF'
]


/**
 * Facade wrapper for a TextMesh. All configuration properties of TextMesh
 * are accepted and proxied through directly.
 */
class Text3DFacade extends Object3DFacade {
  constructor(parent) {
    const mesh = new TextMesh()
    mesh.geometry.boundingSphere.version = 0
    super(parent, mesh)

    /* TODO mirroring to DOM...?
    const el = this._domEl = document.createElement('section')
    el.style = 'position:fixed;left:-99px;overflow:hidden;width:10px;height:10px;'
    document.body.appendChild(el) //should insert into local element
    */

    this.selectable = false
    this.selectionStart = this.selectionEnd = -1
    this.onSyncStart = null
    this.onSyncComplete = null

    mesh.addEventListener('syncstart', e => {
      this.notifyWorld('text3DSyncStart')
      if (this.onSyncStart) {
        this.onSyncStart()
      }
    })
    mesh.addEventListener('synccomplete', e => {
      if (!this.isDestroying) {
        mesh.geometry.boundingSphere.version++
        this.afterUpdate()
        this.notifyWorld('text3DSyncComplete')
        this.notifyWorld('needsRender')
        if (this.onSyncComplete) {
          this.onSyncComplete()
        }
      }
    })
  }

  get textRenderInfo() {
    return this.threeObject.textRenderInfo
  }

  afterUpdate() {
    const textMesh = this.threeObject
    TEXT_MESH_PROPS.forEach(prop => {
      textMesh[prop] = this[prop]
    })
    textMesh.sync()

    super.afterUpdate()

    if (this.text !== this._prevText) {
      // TODO mirror to DOM... this._domEl.textContent = this.text
      // Clear selection when text changes
      this.selectionStart = this.selectionEnd = -1
      this._prevText = this.text
    }

    this._updateSelection()
  }

  _updateSelection() {
    const {selectable, selectionStart, selectionEnd} = this
    let selFacade = this._selectionFacade
    if (selectable !== this._selectable) {
      this._selectable = selectable
      if (selectable) {
        selFacade = this._selectionFacade = new SelectionManagerFacade(this, (start, end) => {
          this.selectionStart = start
          this.selectionEnd = end
          this._updateSelection()
          this.notifyWorld('needsRender')
        })
      } else {
        if (selFacade) {
          selFacade.destructor()
          selFacade = this._selectionFacade = null
        }
        this.selectionStart = this.selectionEnd = -1
      }
    }
    if (selFacade) {
      selFacade.textRenderInfo = this.threeObject.textRenderInfo
      selFacade.selectionStart = selectionStart
      selFacade.selectionEnd = selectionEnd
      selFacade.clipRect = this.clipRect
      selFacade.renderOrder = this.renderOrder
      selFacade.afterUpdate()
    }

    /* TODO update selection in DOM...
    const {selectionStart, selectionEnd} = this
    if (selectionStart !== this._prevSelStart || selectionEnd !== this._prevSelEnd) {
      this._prevSelStart = selectionStart
      this._prevSelEnd = selectionEnd
      const sel = document.getSelection()
      sel.removeAllRanges()
      if (this.selectable && selectionStart > -1 && selectionEnd > selectionStart) {
        const range = document.createRange()
        range.setStart(this._domEl.firstChild, this.selectionStart)
        range.setEnd(this._domEl.firstChild, this.selectionEnd)
        sel.addRange(range)
      }
    }
    */
  }

  destructor() {
    this.threeObject.dispose()
    //this._domEl.parentNode.removeChild(this._domEl)
    if (this._selectionFacade) {
      this._selectionFacade.destructor()
    }
    super.destructor()
  }
}

export default Text3DFacade
