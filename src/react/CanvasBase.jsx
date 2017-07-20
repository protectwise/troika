import React from 'react'
import HtmlOverlay from './HtmlOverlay.jsx'
const T = React.PropTypes



export const commonPropTypes = {
  width: T.number.isRequired,
  height: T.number.isRequired,
  pixelRatio: T.number,
  className: T.string,
  cursor: T.string
}


export const commonMethods = {
  componentDidUpdate() {
    if (this._world) {
      this.updateWorld(this._world)
    }
  },

  _bindCanvasRef(canvas) {
    if (canvas) {
      try {
        let world = this._world = this.initWorld(canvas)
        this.updateWorld(world)
      } catch(e) {
        console.warn(`Troika.${this.constructor.displayName}: world init failed`, e)
        this._failedWorldInit = true
        this.forceUpdate()
      }
    } else {
      this.destroyWorld()
    }
  },

  /**
   * @template
   */
  initWorld(canvas) {},

  /**
   * @template
   */
  updateWorld(world) {},

  destroyWorld() { //just to see it burn
    if (this._world) {
      this._world.destructor()
      delete this._world
    }
  },

  renderHtmlItems(items) {
    if (this._htmlOverlayRef) {
      this._htmlOverlayRef.setItems(items)
    }
  },

  _bindHtmlOverlayRef(cmp) {
    this._htmlOverlayRef = cmp
  },

  render() {
    let {props} = this
    return (
      <div className={ `troika ${props.className || ''}` } style={ {
        position: 'relative',
        overflow: 'hidden',
        width: props.width,
        height: props.height,
        cursor: props.cursor,
        userSelect: 'none'
      } }>
        { this._failedWorldInit ? this.props.children : (
          <canvas className="troika_canvas" ref={ this._bindCanvasRef } />
        ) }
        <HtmlOverlay ref={ this._bindHtmlOverlayRef } />
      </div>
    )
  }
}
