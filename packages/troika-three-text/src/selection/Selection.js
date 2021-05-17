import { Raycaster, Vector2 } from 'three'
import { getCaretAtPoint, getSelectionRects } from '../selectionUtils.js'
import { RangeHighlight } from './RangeHighlight.js'

const raycaster = new Raycaster()
const tempArray = []

function rayToTextCoords (ray, text, todoAllowOutside) {
  raycaster.ray.copy(ray)
  tempArray.length = 0
  text.raycast(raycaster, tempArray)
  const ix = tempArray.length ? tempArray.sort((a, b) => a.distance - b.distance)[0] : null
  return ix ? text.worldPositionToTextCoords(ix.point, new Vector2()) : null
}

export class Selection {
  constructor (textInstance) {
    this._target = textInstance
    this._start = this._end = -1

    let dragStartIdx = -1
    this.dragInteraction = {
      start: (ray) => {
        const xy = rayToTextCoords(ray, textInstance)
        const caret = xy ? getCaretAtPoint(textInstance.textRenderInfo, xy.x, xy.y) : null
        if (caret) {
          dragStartIdx = caret.charIndex
          this.set(dragStartIdx, dragStartIdx)
        } else {
          this.clear()
        }
      },
      move: (ray) => {
        if (dragStartIdx > -1) {
          const xy = rayToTextCoords(ray, textInstance) //TODO allow outside bounds
          const caret = xy ? getCaretAtPoint(textInstance.textRenderInfo, xy.x, xy.y) : null
          if (caret) {
            this.set(Math.min(caret.charIndex, dragStartIdx), Math.max(caret.charIndex, dragStartIdx))
          }
        }
      },
      end: () => {
        dragStartIdx = -1
      }
    }
  }

  get start () {
    return this._start
  }

  set start (index) {
    this.set(index, this._end)
  }

  get end () {
    return this._end
  }

  set end (index) {
    this.set(this._start, index)
  }

  get rects () {
    return this.isEmpty() ? null : getSelectionRects(this._target.textRenderInfo, this._start, this._end)
  }

  get text () {
    return (this._target.text || '').slice(this._start, this._end)
  }

  set (start, end) {
    start = +start
    end = +end
    if (isNaN(start)) start = -1
    if (isNaN(end)) end = -1
    if (start > end) {
      let tmp = start
      start = end
      end = tmp
    }
    if (start !== this._start || end !== this._end) {
      this._start = start
      this._end = end
      this._target.dispatchEvent({ type: 'selectionchange' })

      // Sync highlight display
      let highlight = this._highlight
      if (this.isEmpty()) {
        if (highlight) {
          highlight.visible = false
        }
      } else {
        if (!highlight) {
          highlight = this._highlight = new RangeHighlight(this._target)
        }
        if (highlight.parent !== this._target) { //always check in case it got removed
          this._target.add(highlight)
        }
        highlight.setRange(start, end)
        highlight.visible = true
        highlight.updateMatrixWorld(true)
      }
    }
  }

  selectAll () {
    this.set(0, (this._target.text || '').length)
  }

  clear () {
    this.set(-1, -1)
  }

  isEmpty () {
    const { start, end } = this
    return start === end || start < 0 || end < 0 || !this._target.textRenderInfo
  }

}
