import { Group3DFacade } from 'troika-3d'
import { Matrix4, Plane, Vector3 } from 'three'
import { getCaretAtPoint, getSelectionRects } from '../selectionUtils'
import SelectionRangeRect from './SelectionRangeRect'

const THICKNESS = 0.25 //rect depth as percentage of height

const tempMat4 = new Matrix4()
const tempPlane = new Plane()
const tempVec3 = new Vector3()

/**
 * Manager facade for selection rects and user selection behavior
 */
class SelectionManagerFacade extends Group3DFacade {
  constructor (parent, onSelectionChange) {
    super(parent)
    const textMesh = parent.threeObject

    this.rangeColor = 0x00ccff

    const onDragStart = e => {
      const textRenderInfo = this.textRenderInfo
      if (textRenderInfo) {
        const localPoint = e.intersection.point.clone().applyMatrix4(tempMat4.getInverse(textMesh.matrixWorld))
        const caret = getCaretAtPoint(textRenderInfo, localPoint.x, localPoint.y)
        if (caret) {
          onSelectionChange(caret.charIndex, caret.charIndex)
          parent.addEventListener('drag', onDrag)
          parent.addEventListener('dragend', onDragEnd)
        }
      }
    }

    const onDrag = e => {
      const textRenderInfo = textMesh.textRenderInfo
      if (e.ray && textRenderInfo) {
        // Raycast to an infinite plane so dragging outside the text bounds will work
        const ray = e.ray.clone().applyMatrix4(tempMat4.getInverse(textMesh.matrixWorld))
        const localPoint = ray.intersectPlane(tempPlane.setComponents(0, 0, 1, 0), tempVec3)
        if (localPoint) {
          const caret = getCaretAtPoint(textRenderInfo, localPoint.x, localPoint.y)
          if (caret) {
            onSelectionChange(this.selectionStart, caret.charIndex)
          }
        }
      }
    }

    const onDragEnd = e => {
      parent.removeEventListener('drag', onDrag)
      parent.removeEventListener('dragend', onDragEnd)
    }

    parent.addEventListener('dragstart', onDragStart)
    parent.addEventListener('mousedown', onDragStart)

    this._cleanupEvents = () => {
      onDragEnd()
      parent.removeEventListener('dragstart', onDragStart)
      parent.removeEventListener('mousedown', onDragStart)
    }
  }

  afterUpdate() {
    const rects = getSelectionRects(this.textRenderInfo, this.selectionStart, this.selectionEnd)

    if (rects) {
      // TODO make the rects into a single draw call, either by instancing or updating a single geometry
      this.children = rects.map(({top, right, bottom, left}, i) => ({
        key: `rect${i}`,
        facade: SelectionRangeRect,
        top, right, bottom, left,
        z: (top - bottom) * THICKNESS / 2,
        scaleZ: (top - bottom) * THICKNESS,
        color: this.rangeColor,
        renderOrder: this.renderOrder || 0
      }))
    } else {
      this.children = null
    }
    super.afterUpdate()
  }

  destructor () {
    this._cleanupEvents()
    super.destructor()
  }
}


export default SelectionManagerFacade