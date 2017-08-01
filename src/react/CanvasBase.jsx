import React from 'react'
import T from 'prop-types'
import HtmlOverlay from './HtmlOverlay.jsx'



export const commonPropTypes = {
  width: T.number.isRequired,
  height: T.number.isRequired,
  pixelRatio: T.number,
  className: T.string,
  cursor: T.string
}


// export const commonMethods = {

export default class CanvasBase extends React.Component {
  constructor(props) {
    super(props)
    this.initWorld = this.initWorld.bind(this)
    this.updateWorld = this.updateWorld.bind(this)
    this.destroyWorld = this.destroyWorld.bind(this)
    this.renderHtmlItems = this.renderHtmlItems.bind(this)
    this._bindHtmlOverlayRef = this._bindHtmlOverlayRef.bind(this)
    this._bindCanvasRef = this._bindCanvasRef.bind(this)
  }

  componentDidUpdate() {
    if (this._world) {
      this.updateWorld(this._world)
    }
  }

  /**
   * @template
   */
  initWorld(canvas) {}

  /**
   * @template
   */
  updateWorld(world) {}

  destroyWorld() { //just to see it burn
    if (this._world) {
      this._world.destructor()
      delete this._world
    }
  }

  renderHtmlItems(items) {
    if (this._htmlOverlayRef) {
      this._htmlOverlayRef.setItems(items)
    }
  }

  _bindHtmlOverlayRef(cmp) {
    this._htmlOverlayRef = cmp
  }

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
  }

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


