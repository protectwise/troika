import { Object3DFacade } from 'troika-3d'
import { Text } from 'troika-three-text'

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
  'direction',
  'textAlign',
  'textIndent',
  'whiteSpace',
  'material',
  'color',
  'selectionColor',
  'selectionMaterial',
  'colorRanges',
  'fillOpacity',
  'outlineOpacity',
  'outlineColor',
  'outlineWidth',
  'outlineOffsetX',
  'outlineOffsetY',
  'outlineBlur',
  'strokeColor',
  'strokeWidth',
  'strokeOpacity',
  'curveRadius',
  'depthOffset',
  'clipRect',
  'orientation',
  'glyphGeometryDetail',
  'sdfGlyphSize',
  'debugSDF'
]

/**
 * Facade wrapper for a TextMesh. All configuration properties of TextMesh
 * are accepted and proxied through directly.
 */
class Text3DFacade extends Object3DFacade {
  constructor (parent) {
    const mesh = new Text()
    mesh.geometry.boundingSphere.version = 0
    super(parent, mesh)

    this.selectable = false
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
        this.requestRender()
        if (this.onSyncComplete) {
          this.onSyncComplete()
        }
      }
    })
  }

  get textRenderInfo () {
    return this.threeObject.textRenderInfo
  }

  get selectable () {
    return this._selectable
  }

  set selectable (selectable) {
    selectable = !!selectable
    if (selectable !== this._selectable) {
      this._selectable = selectable
      const method = selectable ? 'addEventListener' : 'removeEventListener'
      for (let evt in dragHandlers) {
        this[method](evt, dragHandlers[evt])
      }
      this.getSceneFacade()[method]('mousedown', this._onMiss || (this._onMiss = e => {
        this.threeObject.selection.clear()
      }))
    }
  }

  afterUpdate () {
    const textMesh = this.threeObject
    TEXT_MESH_PROPS.forEach(prop => {
      textMesh[prop] = this[prop]
    })
    textMesh.sync()

    super.afterUpdate()

    if (this.accessible && !this.threeObject.isDOMAccessible) {
      //makeDOMAcessible(this.threeObject)
    }
  }

  destructor () {
    this.threeObject.dispose()
    super.destructor()
  }
}

const getDragIx = e => e.target.threeObject.selection.dragInteraction
const dragHandlers = {
  dragstart (e) {
    getDragIx(e).start(e.ray)
  },
  drag (e) {
    getDragIx(e).move(e.ray)
  },
  dragend (e) {
    getDragIx(e).end()
  }
}

export default Text3DFacade
