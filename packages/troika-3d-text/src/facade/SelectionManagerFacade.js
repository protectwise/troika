import { ListFacade } from 'troika-3d'
import { Matrix4, Plane, Vector3 } from 'three'
import { getCaretAtPoint, getSelectionRects } from '../selectionUtils.js'
import SelectionRangeRect from './SelectionRangeRect.js'

const THICKNESS = 0.25 //rect depth as percentage of height

const tempMat4 = new Matrix4()
const tempPlane = new Plane()
const tempVec3 = new Vector3()
const noClip = Object.freeze([-Infinity, -Infinity, Infinity, Infinity])

/**
 * Manager facade for selection rects and user selection behavior
 */
class SelectionManagerFacade extends ListFacade {
  constructor (parent, onSelectionChange) {
    super(parent)
    const textMesh = parent.threeObject

    this.rangeColor = 0x00ccff
    this.clipRect = noClip

    this.template = {
      key: (d, i) => `rect${i}`,
      facade: SelectionRangeRect,
      top: d => clamp(d.top, this.clipRect[1], this.clipRect[3]),
      right: d => clamp(d.right, this.clipRect[0], this.clipRect[2]),
      bottom: d => clamp(d.bottom, this.clipRect[1], this.clipRect[3]),
      left: d => clamp(d.left, this.clipRect[0], this.clipRect[2]),
      z: d => (d.top - d.bottom) * THICKNESS / 2,
      scaleZ: d => (d.top - d.bottom) * THICKNESS,
      color: d => this.rangeColor,
      visible: d => {
        let r = this.clipRect
        return d.right > r[0] && d.top > r[1] && d.left < r[2] && d.bottom < r[3]
      },
      renderOrder: d => this.renderOrder || 0
    }

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
        e.preventDefault()
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
        e.preventDefault()
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
    this.data = getSelectionRects(this.textRenderInfo, this.selectionStart, this.selectionEnd)
    super.afterUpdate()
  }

  // normalize clipRect
  set clipRect(clipRect) {
    this._clipRect = (clipRect && Array.isArray(clipRect) && clipRect.length === 4) ? clipRect : noClip
  }
  get clipRect() {
    return this._clipRect
  }

  destructor () {
    this._cleanupEvents()
    super.destructor()
  }
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val))
}

export default SelectionManagerFacade
