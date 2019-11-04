import React from 'react'

export default class XRLauncher extends React.PureComponent {
  constructor(props) {
    super(props)

    this._onClick = this._onClick.bind(this)
  }

  _onClick() {
    this.props.onSelectSession(this.props.xrSession ? null : 'immersive-vr') //TODO handle other modes
  }

  render() {
    const props = this.props
    return (
      <button onClick={this._onClick} disabled={!props.xrSupported}>
        {props.xrSupported ? (props.xrSession ? 'Exit XR' : 'Enter XR') : 'XR Not Available'}
      </button>
    )
  }
}
