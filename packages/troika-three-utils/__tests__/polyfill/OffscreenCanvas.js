import 'event-target-polyfill'
import createGlContext from 'gl'

const _width = Symbol()
const _height = Symbol()
const _context = Symbol()

/**
 * Basic polyfill for OffscreenCanvas for tests
 */
class OffscreenCanvas extends EventTarget {
  constructor (width, height) {
    super()
    this[_width] = width
    this[_height] = height
  }

  set width(width) {
    if (width !== this[_width]) {
      this[_width] = width
      if (this[_context]) {
        this[_context].getExtension('STACKGL_resize_drawingbuffer').resize(width, this[_height])
      }
    }
  }
  get width() {
    return this[_width]
  }

  set height(height) {
    if (height !== this[_height]) {
      this[_height] = height
      if (this[_context]) {
        this[_context].getExtension('STACKGL_resize_drawingbuffer').resize(this[_width], height)
      }
    }
  }
  get height() {
    return this[_height]
  }

  getContext(type, webglContextAttrs) {
    if (type !== 'webgl') {
      throw new Error('Only webgl context supported')
    }
    let ctx = this[_context]
    if (!ctx) {
      ctx = this[_context] = createGlContext(this.width, this.height, webglContextAttrs)
      ctx.canvas = this
    }
    return ctx
  }
}

global.OffscreenCanvas = OffscreenCanvas
