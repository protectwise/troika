import React from 'react'
import T from 'prop-types'
import HtmlOverlay from './HtmlOverlay.jsx'
import Stats from './Stats.jsx'
import {assign} from '../utils'

export const commonPropTypes = {
  width: T.number.isRequired,
  height: T.number.isRequired,
  pixelRatio: T.number,
  className: T.string,
  continuousRender: T.bool,
  stats: T.bool,
  cursor: T.string
}

// export const commonMethods = {

export default class CanvasBase extends React.Component {
  constructor(props) {
    super(props)
    this._stats = {}
    this.updateStats = this.updateStats.bind(this)
    this.renderHtmlItems = this.renderHtmlItems.bind(this)
    this._bindHtmlOverlayRef = this._bindHtmlOverlayRef.bind(this)
    this._bindCanvasRef = this._bindCanvasRef.bind(this)
    this._bindStatsRef = this._bindStatsRef.bind(this)
  }

  componentDidUpdate() {
    if (this._world) {
      this._updateWorld(this._world)
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

  _updateWorld(world) {
    let useStats = this.props.stats
    let start = useStats && Date.now()
    this.updateWorld(world)
    if (useStats) {
      this.updateStats({'Last World Update (ms)': Date.now() - start})
    }
  }

  destroyWorld() {
    //just to see it burn
    if (this._world) {
      this._world.destructor()
      delete this._world
    }
    clearTimeout(this._statsDelay)
  }

  renderHtmlItems(items) {
    if (this._htmlOverlayRef) {
      this._htmlOverlayRef.setItems(items)
    }
  }

  updateStats(stats) {
    this._stats = assign({}, this._stats, stats)

    if (!this._statsDelay) {
      this._statsDelay = setTimeout(() => {
        this._statsDelay = null
        let ref = this._statsRef
        if (ref) {
          ref.setStats(this._stats)
        }
      }, 250)
    }
  }

  _bindHtmlOverlayRef(cmp) {
    this._htmlOverlayRef = cmp
  }

  _bindCanvasRef(canvas) {
    if (canvas) {
      try {
        let world = (this._world = this.initWorld(canvas))
        this._updateWorld(world)
      } catch (e) {
        console.warn(
          `Troika.${this.constructor.displayName}: world init failed`,
          e
        )
        this._failedWorldInit = true
        this.forceUpdate()
      }
    } else {
      this.destroyWorld()
    }
  }

  _bindStatsRef(ref) {
    this._statsRef = ref
  }

  render() {
    let { props } = this
    return (
      <div
        className={`troika ${props.className || ''}`}
        style={{
          position: 'relative',
          overflow: 'hidden',
          width: props.width,
          height: props.height,
          cursor: props.cursor,
          userSelect: 'none'
        }}
      >
        {this._failedWorldInit
          ? this.props.children
          : <canvas className="troika_canvas" ref={this._bindCanvasRef} />}
        <HtmlOverlay ref={this._bindHtmlOverlayRef} />

        {props.stats ? (
          <Stats ref={this._bindStatsRef} />
        ) : null}
      </div>
    )
  }
}
