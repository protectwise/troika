import { Object3DFacade } from 'troika-3d'
import { TextMesh } from '../three/TextMesh.js'


// Properties that will simply be forwarded to the TextMesh:
const TEXT_MESH_PROPS = [
  'text',
  'anchor',
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
  'depthOffset',
  'clipRect',
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
  }

  afterUpdate() {
    const textMesh = this.threeObject
    TEXT_MESH_PROPS.forEach(prop => {
      textMesh[prop] = this[prop]
    })
    textMesh.sync(() => {
      if (!this.isDestroying) {
        textMesh.geometry.boundingSphere.version++
        this.notifyWorld('needsRender')
      }
    })
    super.afterUpdate()
  }

  destructor() {
    this.threeObject.dispose()
    super.destructor()
  }
}

export default Text3DFacade
