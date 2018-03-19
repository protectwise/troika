import ParentFacade from './ParentFacade'
import {defineEventProperty} from './Facade'




export const pointerMotionEventProps = [
  'onMouseOver',
  'onMouseOut',
  'onMouseMove',
  'onDragStart',
  'onDrag',
  'onDragEnter',
  'onDragOver',
  'onDragLeave'
]

export const pointerActionEventProps = [
  'onMouseDown',
  'onMouseUp',
  'onClick',
  'onDoubleClick',
  'onDrop',
  'onDragEnd',
  'onWheel'
]

export const pointerEventProps = pointerMotionEventProps.concat(pointerActionEventProps)



class PointerEventTarget extends ParentFacade {
  /**
   * Determine if this PointerEventTarget should intercept pointer events:
   * - By default only facades with a pointer event listener assigned will be counted, to prevent being blocked by unwanted objects
   * - If an object should definitely block events from objects behind it, set `pointerEvents:true`
   * - If an object has one of the pointer event properties but should be ignored in picking, set `pointerEvents:false`
   */
  interceptsPointerEvents() {
    if (this.pointerEvents === false) {
      return false
    }
    if (this.pointerEvents) {
      return true
    }
    for (let i = pointerEventProps.length; i--;) {
      if (this[pointerEventProps[i]]) {
        return true
      }
    }
  }
}


Object.defineProperty(PointerEventTarget.prototype, 'isPointerEventTarget', {value: true})


// Add handlers for pointer event properties
pointerEventProps.forEach(eventName => {
  defineEventProperty(PointerEventTarget, eventName)
})

export default PointerEventTarget
