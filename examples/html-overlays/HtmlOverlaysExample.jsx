import React from 'react'
import T from 'prop-types'
import {
  Canvas3D,
  Group3DFacade,
  HtmlOverlay3DFacade
} from '../../src/index'
import Box from './Box'
import Dot from './Dot'
import Glow from './Glow'


class HtmlOverlaysExample extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hoveredBox: null
    }
    this._onBoxMouseOver = this._onBoxMouseOver.bind(this)
    this._onBoxMouseOut = this._onBoxMouseOut.bind(this)
  }

  _onBoxMouseOver(e) {
    this.setState({hoveredBox: e.target.id})
  }

  _onBoxMouseOut() {
    this.setState({hoveredBox: null})
  }

  render() {
    let state = this.state
    let {width, height} = this.props
    let paused = typeof state.hoveredBox === 'number'

    return (
      <div>
        <style type="text/css">@import url("html-overlays/styles.css")</style>

        <Canvas3D
          antialias
          width={ width }
          height={ height }
          lights={ [
            { type: 'ambient', color: 0x666666 },
            { type: 'point', color: 0xffffff, x: 1000, z: 1000 },
            { type: 'point', color: 0xffffff, x: -1000, z: 1000 },
          ] }
          camera={ {
            z: 400,
          } }
          objects={ {
            key: 'main',
            facade: Group3DFacade,
            children: {
              key: 'boxes',
              facade: Group3DFacade,
              children: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'].map((num, i, arr) => {
                let angle = Math.PI * 2 * i / arr.length
                return {
                  key: i,
                  facade: Box,
                  id: i,
                  x: Math.cos(angle) * 100,
                  y: Math.sin(angle) * 100,
                  rotateZ: angle,
                  animation: {
                    from: {rotateX: 0},
                    to: {rotateX: Math.PI},
                    duration: 3000,
                    delay: i * 200,
                    easing: 'easeInOutCubic',
                    direction: 'alternate',
                    iterations: Infinity,
                    paused: i === state.hoveredBox
                  },
                  onMouseOver: this._onBoxMouseOver,
                  onMouseOut: this._onBoxMouseOut,
                  children: [
                    {
                      key: 'dot',
                      facade: Dot,
                      x: 20,
                      y: 20,
                      z: 20
                    },
                    {
                      key: 'glow',
                      facade: Glow,
                      color: 0xffffff,
                      opacity: 0,
                      amount: i === state.hoveredBox ? .05 : 0,
                      transition: {amount: true, opacity: true},
                      animation: i === state.hoveredBox ? {
                        from: {opacity: 0.5},
                        to: {opacity: 1},
                        duration: 500,
                        iterations: Infinity,
                        direction: 'alternate'
                      } : 0
                    },
                    {
                      key: 'html',
                      facade: HtmlOverlay3DFacade,
                      x: 20,
                      y: 20,
                      z: 20,
                      html: (
                        <div className="tip">
                          Object Number {num}
                        </div>
                      )
                    }
                  ]
                }
              }),
              animation: {
                from: {rotateZ: 0},
                to: {rotateZ: Math.PI * 2},
                duration: 6000,
                easing: 'easeInOutCubic',
                direction: 'alternate',
                iterations: Infinity,
                paused: paused
              }
            },
            animation: {
              from: {rotateY: 0},
              to: {rotateY: Math.PI * 2},
              duration: 10000,
              iterations: Infinity,
              paused: paused
            }
          } }
        />

        <div className="example_desc">
          <p>This example uses the <b>HtmlOverlay</b> facade to define tooltips that are anchored to a corner of each box. Their HTML contents are rendered into the DOM, fully styleable, and synchronized to the position of their anchor point in the 3D world as projected to the camera. Also demonstrated: nested animations with pausing and a glow effect on hover.</p>
        </div>

        <div className="example_controls">
        </div>
      </div>
    )
  }
}

HtmlOverlaysExample.propTypes = {
  width: T.number,
  height: T.number
}

export default HtmlOverlaysExample
