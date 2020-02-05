import React from 'react'
import T from 'prop-types'

const CT_STYLES = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  pointerEvents: 'none',
  transformStyle: 'preserve-3d'
}

class HtmlOverlayContent extends React.Component {
  shouldComponentUpdate (newProps) {
    return (
      newProps.html !== this.props.html ||
      (newProps.html.props && newProps.html.props.shouldUpdateOnMove) === true
    )
  }

  render () {
    let html = this.props.html
    return typeof html === 'string'
      ? React.createElement('span', null, html)
      : React.cloneElement(html)
  }
}

HtmlOverlayContent.displayName = 'Canvas3D.HtmlOverlayContent'
HtmlOverlayContent.propTypes = {
  html: T.node
}

class HtmlOverlay extends React.Component {
  constructor (props) {
    super(props)
    this.setItems = this.setItems.bind(this)
    this.state = {
      items: null
    }
  }

  shouldComponentUpdate (newProps, newState) {
    let oldState = this.state
    return (
      (newState.items && newState.items.length) ||
      (oldState.items && oldState.items.length)
    )
  }

  setItems (items) {
    let lastItems = this.state.items
    if ((items && items.length) || (lastItems && lastItems.length)) {
      this.setState({ items: items || null })
    }
  }

  render () {
    let items = this.state.items
    let round = Math.round
    return items && items.length
      ? React.createElement(
        'div',
        {
          className: 'troika_html_overlay',
          style: CT_STYLES
        },
        items.map(({ key, html, x, y, z, exact }) => {
          if (!exact) {
            x = round(x)
            y = round(y)
          }
          return React.createElement(
            'div',
            {
              key,
              style: {
                position: 'absolute',
                transform: `translate3d(${x}px, ${y}px, ${-z}px)`
              }
            },
            React.createElement(HtmlOverlayContent, {html})
          )
        })
      )
      : null
  }
}

HtmlOverlay.displayName = 'Canvas3D.HtmlOverlay'

export default HtmlOverlay
