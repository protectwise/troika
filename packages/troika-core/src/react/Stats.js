import React from 'react'

const style = {
  position: 'absolute',
  top: 0,
  right: 0,
  background: 'rgba(0,0,0,.5)',
  font: '11px sans-serif',
  padding: 10
}

class Stats extends React.Component {
  constructor(props) {
    super(props)
    this.state = {stats: {}}
  }

  setStats(stats) {
    this.setState({stats})
  }

  render() {
    let stats = this.state.stats
    return (
      React.createElement(
        'div',
        {style},
        Object.keys(stats).sort().map(key =>
          React.createElement('div', {key}, `${ key }: ${ stats[key] }`)
        )
      )
    )
  }
}


export default Stats
