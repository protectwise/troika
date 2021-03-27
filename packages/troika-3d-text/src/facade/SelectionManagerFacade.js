import { ListFacade } from 'troika-3d'
import { Matrix4, Plane, Vector2, Vector3 } from 'three'
import { getCaretAtPoint, getSelectionRects } from 'troika-three-text'
import { invertMatrix4 } from 'troika-three-utils'
import SelectionRangeRect from './SelectionRangeRect.js'

const THICKNESS = 0.25 //rect depth as percentage of height

const tempMat4 = new Matrix4()
const tempPlane = new Plane()
const tempVec2 = new Vector2()
const tempVec3 = new Vector3()
const noClip = Object.freeze([-Infinity, -Infinity, Infinity, Infinity])

/**
 * Manager facade for selection rects and user selection behavior
 */
class SelectionManagerFacade extends ListFacade {
  constructor(parent, onSelectionChange) {
    super(parent)
    const textMesh = parent.threeObject

    this.rangeColor = 0x00ccff
    this.clipRect = noClip
    this.curveRadius = 0

    this.template = {
      key: (d, i) => `rect${i}`,
      facade: SelectionRangeRect,
      top: d => clamp(d.top, this.clipRect[1], this.clipRect[3]),
      right: d => clamp(d.right, this.clipRect[0], this.clipRect[2]),
      bottom: d => clamp(d.bottom, this.clipRect[1], this.clipRect[3]),
      left: d => clamp(d.left, this.clipRect[0], this.clipRect[2]),
      depth: d => (d.top - d.bottom) * THICKNESS,
      color: d => this.rangeColor,
      curveRadius: d => this.curveRadius,
      visible: d => {
        let r = this.clipRect
        return d.right > r[0] && d.top > r[1] && d.left < r[2] && d.bottom < r[3]
      },
      renderOrder: d => this.renderOrder || 0
    }

    const onDragStart = e => {
      if (e.which === 3) {//contextmenu
        return false
      }
      const textRenderInfo = textMesh.textRenderInfo
      if (textRenderInfo) {
        const textPos = textMesh.worldPositionToTextCoords(e.intersection.point, tempVec2)
        const caret = getCaretAtPoint(textRenderInfo, textPos.x, textPos.y)
        if (caret) {
          textMesh.selectionStartIndex = caret.charIndex
          textMesh.selectionEndIndex = caret.charIndex
          textMesh.updateSelection(textRenderInfo)
          onSelectionChange(caret.charIndex, caret.charIndex)
          parent.addEventListener('drag', onDrag)
          parent.addEventListener('dragend', onDragEnd)
        }
        e.preventDefault()
      }
    }

    const onDrag = e => {
      if (e.which === 3) {//contextmenu
        return false
      }
      const textRenderInfo = textMesh.textRenderInfo
      if (e.ray && textRenderInfo) {
        // If it's hitting on the Text mesh, do an exact translation; otherwise raycast to an
        // infinite plane so dragging outside the text bounds will work
        let textPos
        const ix = e.intersection
        if (ix && ix.object === textMesh && ix.point) {
          textPos = textMesh.worldPositionToTextCoords(ix.point, tempVec2)
        } else {
          // const ray = e.ray.clone().applyMatrix4(invertMatrix4(textMesh.matrixWorld, tempMat4))
          // textPos = ray.intersectPlane(tempPlane.setComponents(0, 0, 1, 0), tempVec3)
        }
        if (textPos) {
          const caret = getCaretAtPoint(textRenderInfo, textPos.x, textPos.y)
          if (caret) {
            textMesh.selectionEndIndex = caret.charIndex
            textMesh.updateSelection(textRenderInfo)
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

    const onMissClick = e => {
      let target = e.target
      do {
        if (target.$facadeId === textMesh.parent.$facade.$facadeId) {
          return
        }
        target = target.parent
      } while (target !== null)
      //clear selection
      const textRenderInfo = textMesh.textRenderInfo
      if (textRenderInfo) {
        textMesh.selectionStartIndex = 0
        textMesh.selectionEndIndex = 0
        textMesh.updateSelection(textRenderInfo)
      }
    }

    //clear selection if missed click
    parent.getSceneFacade().addEventListener('click', onMissClick)

    parent.addEventListener('dragstart', onDragStart)
    parent.addEventListener('mousedown', onDragStart)
    var canvas = parent.getSceneFacade().parent._threeRenderer.domElement;
    canvas.addEventListener('contextmenu', (e) => {
      textMesh._domElSelectedText.style.pointerEvents = 'auto'
      textMesh.selectDomText()
      window.setTimeout(() => {
        textMesh._domElSelectedText.style.pointerEvents = 'none'
      }, 50)
    })

    this._cleanupEvents = () => {
      onDragEnd()
      parent.getSceneFacade().removeEventListener('click', onMissClick)
      parent.removeEventListener('dragstart', onDragStart)
      parent.removeEventListener('mousedown', onDragStart)
    }
  }

  afterUpdate() {
    super.afterUpdate()
  }

  // normalize clipRect
  set clipRect(clipRect) {
    this._clipRect = (clipRect && Array.isArray(clipRect) && clipRect.length === 4) ? clipRect : noClip
  }
  get clipRect() {
    return this._clipRect
  }

  destructor() {
    this._cleanupEvents()
    super.destructor()
  }
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val))
}

export default SelectionManagerFacade
