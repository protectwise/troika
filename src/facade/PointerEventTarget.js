import ParentFacade from './Parent'



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

  destructor() {
    pointerEventProps.forEach(type => {
      this[`${type}➤handler`] = null
    })
    super.destructor()
  }
}


Object.defineProperty(PointerEventTarget.prototype, 'isPointerEventTarget', {value: true})


// Add handlers for pointer event properties
pointerEventProps.forEach(eventName => {
  let privateProp = `${ eventName }➤handler`
  Object.defineProperty(PointerEventTarget.prototype, eventName, {
    get() {
      return this[privateProp]
    },
    set(handler) {
      if ((handler || null) !== (this[eventName] || null)) {
        this[privateProp] = handler

        // Add/remove from the global event registry
        this.notifyWorld(handler ? 'addEventListener' : 'removeEventListener', {
          type: eventName,
          handler: handler
        })
      }
    }
  })
})

export default PointerEventTarget
