import React from 'react'
import T from 'prop-types'
import HtmlOverlay from './HtmlOverlay.js'
import Stats from './Stats.js'
import {assign} from '../utils.js'


const defaultCanvasStyle = {width: '100%', height: '100%'}


class CanvasBase extends React.Component {
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
    this.updateWorld()
  }

  initWorld(canvas) {
    const world = new this.props.worldFacade(canvas)
    world.renderHtmlItems = this.renderHtmlItems
    return world
  }

  updateWorld() {
    const world = this._world
    if (world) {
      const {props} = this
      let useStats = props.stats
      let start = useStats && Date.now()

      world.width = props.width
      world.height = props.height
      world.pixelRatio = props.pixelRatio
      world.continuousRender = props.continuousRender
      world.onStatsUpdate = useStats ? this.updateStats : null
      assign(world, props.worldProps)
      world.afterUpdate()

      if (useStats) {
        this.updateStats({'Last World Update (ms)': Date.now() - start})
      }
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
        this._world = this.initWorld(canvas)
        this.updateWorld()
      } catch (e) {
        console.warn(`Troika.${this.constructor.displayName}: world init failed, using fallback content.`, e)
        this._failedWorldInit = true
        this._world = null
        this.forceUpdate()
      }
    } else {
      this.destroyWorld()
    }

    // Call external ref callback
    const cb = this.props.onCanvasRef
    if (cb) cb(canvas)
  }

  _bindStatsRef(ref) {
    this._statsRef = ref
  }

  render() {
    let { props } = this
    return (
      React.createElement(
        'div',
        {
          className: `troika ${props.className || ''}`,
          style: {
            position: 'relative',
            overflow: 'hidden',
            width: props.width,
            height: props.height,
            cursor: props.cursor,
            userSelect: 'none'
          }
        },
        this._failedWorldInit ? this.props.children : React.createElement(
          'canvas',
          {
            className: "troika_canvas",
            ref: this._bindCanvasRef,
            style: props.canvasStyle || defaultCanvasStyle
          }
        ),
        React.createElement(HtmlOverlay, {ref: this._bindHtmlOverlayRef}),
        props.stats ? React.createElement(Stats, {ref: this._bindStatsRef}) : null
      )
    )
  }
}

CanvasBase.commonPropTypes = {
  width: T.number.isRequired,
  height: T.number.isRequired,
  pixelRatio: T.number,
  worldFacade: T.func,
  worldProps: T.object,
  canvasStyle: T.object,
  className: T.string,
  continuousRender: T.bool,
  onCanvasRef: T.func,
  stats: T.bool,
  cursor: T.string
}

export default CanvasBase
