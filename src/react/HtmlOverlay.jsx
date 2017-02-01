import React from 'react'


const CT_STYLES = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  pointerEvents: 'none',
  transformStyle: 'preserve-3d'
}

const HtmlOverlayContent = React.createClass({
  displayName: 'Canvas3D.HtmlOverlayContent',
  shouldComponentUpdate(newProps) {
    return newProps.html !== this.props.html ||
      (newProps.html.props && newProps.html.props.shouldUpdateOnMove)
  },
  render() {
    let html = this.props.html
    return typeof html === 'string' ? <span>{ html }</span> : React.cloneElement(html)
  }
})

const HtmlOverlay = React.createClass({
  displayName: 'Canvas3D.HtmlOverlay',

  getInitialState() {
    return {
      items: null
    }
  },

  setItems(items) {
    let lastItems = this.state.items
    if ((items && items.length) || (lastItems && lastItems.length)) {
      this.setState({items: items || null})
    }
  },

  shouldComponentUpdate(newProps, newState) {
    let oldState = this.state
    return (newState.items && newState.items.length) || (oldState.items && oldState.items.length)
  },

  render() {
    let items = this.state.items
    let round = Math.round
    return items && items.length ? (
      <div style={ CT_STYLES }>
        { items.map(({key, html, x, y, z}) => {
          return (
            <div key={ key } style={ {
              position: 'absolute',
              transform: `translate3d(${ round(x) }px, ${ round(y) }px, ${-z}px)`}
            }>
              <HtmlOverlayContent html={ html } />
            </div>
          )
        }) }
      </div>
    ) : null
  }
})

export default HtmlOverlay
