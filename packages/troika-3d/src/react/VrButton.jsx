import React from 'react'

export default class VrButton extends React.PureComponent {
  render() {
    const props = this.props
    return (
      <button onClick={props.onClick} disabled={!props.vrAvailable}>
        {props.vrAvailable ? (props.vrDisplay ? 'Exit VR' : 'Enter VR') : 'VR Not Available'}
      </button>
    )
  }
}
