import React from 'react'
import T from 'prop-types'
import {utils} from 'troika-core'
import {Canvas3D} from 'troika-3d'
import VrButton from './VrButton.jsx'
import WorldVrFacade from '../facade/WorldVrFacade.js'


function getVrDisplays() {
  return navigator.getVRDisplays ? navigator.getVRDisplays() : Promise.resolve([])
}

export const vrAwarePropTypes = {
  vrAvailable: T.bool,
  vrDisplay: T.object,
  vrButton: T.element
}

const vrEvents = ['vrdisplayconnect', 'vrdisplaydisconnect', 'vrdisplaypresentchange']


export function makeVrAware(ReactClass, options) {
  options = utils.assign({
    buttonRenderer: VrButton
  }, options)

  class VrAware extends React.Component {
    constructor(props) {
      super(props)

      this.state = {
        vrAvailable: false,
        vrDisplay: null
      }

      this._onVrButtonClick = this._onVrButtonClick.bind(this)
      this._registerVrCanvas = this._registerVrCanvas.bind(this)

      const checkVrDisplays = this._checkVrDisplays = this._checkVrDisplays.bind(this)
      vrEvents.forEach(name => {
        window.addEventListener(name, checkVrDisplays, false)
      })
      checkVrDisplays()
    }

    componentWillUnmount() {
      const checkVrDisplays = this._checkVrDisplays
      vrEvents.forEach(name => {
        window.removeEventListener(name, checkVrDisplays, false)
      })
    }

    _registerVrCanvas(canvas) {
      if (canvas !== this._vrCanvas) {
        this._exitPresent() //quit existing session when the canvas changes
        this._vrCanvas = canvas
        this._checkVrDisplays()
      }
    }

    _checkVrDisplays() {
      getVrDisplays()
        .then(displays => {
          const activeDisplay = this.state.vrDisplay
          const newState = {
            vrAvailableDisplays: displays,
            vrAvailable: displays.length > 0
          }
          if (activeDisplay && (!activeDisplay.isPresenting || displays.indexOf(activeDisplay) < 0)) {
            newState.vrDisplay = null
          }
          this.setState(newState)
        })
    }

    _onVrButtonClick() {
      let {vrAvailable, vrAvailableDisplays, vrDisplay} = this.state
      if (vrAvailable) {
        if (vrDisplay) {
          this._exitPresent()
        } else {
          vrDisplay = (vrAvailableDisplays && vrAvailableDisplays[0]) || null
          if (vrDisplay && this._vrCanvas) {
            vrDisplay.requestPresent([{source: this._vrCanvas}]).then(() => {
              this.setState({vrDisplay})
            }, err => {
              console.error(err)
            })
          }
        }
      }
    }

    _exitPresent() {
      const activeDisplay = this.state.vrDisplay
      if (activeDisplay) {
        if (activeDisplay.isPresenting) {
          activeDisplay.exitPresent().catch(err => {
            console.error(err)
          })
        }
        this.setState({vrDisplay: null})
      }
    }

    render() {
      const {props, state} = this
      const {vrDisplay, vrAvailable} = state

      const VrButtonImpl = options.buttonRenderer
      const vrButton = <VrButtonImpl
        vrAvailable={vrAvailable}
        vrDisplay={vrDisplay}
        onClick={this._onVrButtonClick}
      />

      const contextValue = {
        worldClass: WorldVrFacade,
        worldProps: { vrDisplay },
        onCanvasRef: this._registerVrCanvas
      }

      return React.createElement(Canvas3D.contextType.Provider, {value: contextValue},
        React.createElement(
          ReactClass,
          utils.assign({}, props, {
            vrAvailable,
            vrDisplay,
            vrButton
          }),
          props.children
        )
      )
    }
  }

  VrAware.displayName = `VrAware(${ReactClass.displayName || ReactClass.name || '?'})`

  return VrAware
}

