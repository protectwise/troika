import ParentFacade from './ParentFacade.js'
import Facade from './Facade.js'




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

export const pointerActionEventTypes = pointerActionEventProps.map(eventPropToType)
export const pointerMotionEventTypes = pointerMotionEventProps.map(eventPropToType)

export const pointerEventProps = pointerMotionEventProps.concat(pointerActionEventProps)
export const pointerEventTypes = pointerMotionEventTypes.concat(pointerActionEventTypes)

function eventPropToType(prop) {
  return prop === 'onDoubleClick' ? 'dblclick' : prop.replace(/^on/, '').toLowerCase()
}


class PointerEventTarget extends ParentFacade {
  /**
   * Determine if this PointerEventTarget should intercept pointer events:
   * - By default only facades with a pointer event listener assigned will be counted, to prevent being blocked by unwanted objects
   * - If an object should definitely block events from objects behind it, set `pointerEvents:true`
   * - If an object has one of the pointer event properties but should be ignored in picking, set `pointerEvents:false`
   */
  interceptsPointerEvents(eventRegistry) {
    if (this.pointerEvents === false) {
      return false
    }
    if (this.pointerEvents) {
      return true
    }
    for (let i = 0, len = pointerEventTypes.length; i < len; i++) {
      if (eventRegistry.hasFacadeListenersOfType(this, pointerEventTypes[i])) {
        return true
      }
    }
  }
}


Object.defineProperty(PointerEventTarget.prototype, 'isPointerEventTarget', {value: true})


// Add handlers for pointer event properties
pointerEventProps.forEach(propName => {
  Facade.defineEventProperty(PointerEventTarget, propName, eventPropToType(propName))
})

export default PointerEventTarget
