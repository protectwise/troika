import React from 'react'
import T from 'prop-types'
import {utils} from 'troika-core'
import {Canvas3D} from 'troika-3d'
import XrLauncher from './XrLauncher.jsx'
import WorldXrFacade from 'src/troika/packages/troika-xr/src/facade/webxr-wip/WorldXrFacade.js'


const SESSION_MODES = ['inline', 'immersive-vr'] //TODO add others as they are added to the specs
const REFERENCE_SPACE_TYPES = ['viewer', 'local', 'local-floor', 'bounded-floor', 'unbounded']


/**
 * The types of the props that are passed down to the wrapped React component
 */
export const xrAwarePropTypes = {
  xrSupported: T.bool,
  xrSupportedSessionModes: T.arrayOf(T.oneOf(SESSION_MODES)),
  xrSession: T.object,
  xrSessionMode: T.oneOf(SESSION_MODES),
  xrReferenceSpace: T.object,
  xrReferenceSpaceType: T.oneOf(REFERENCE_SPACE_TYPES),
  xrLauncher: T.element
}


/**
 * Wraps a React component class/function in a higher-order component which enables support
 * for WebXR. The wrapper handles querying the browser for supported XR session types,
 * initiating a supported XR session, and upgrading any descendant `Canvas3D` components
 * with support for rendering XR stereo views and handling XR input controllers.
 *
 *
 *
 * @param {class|function} ReactClass
 * @param {object} options
 * @return {class}
 */
export function makeXrAware(ReactClass, options) {
  options = utils.assign({
    xrLauncherRenderer: XrLauncher,
    sessionModes: ['immersive-vr', 'local'],
    referenceSpaces: ['local-floor', 'local', 'viewer'],
    requiredFeatures: [],
    optionalFeatures: []
  }, options)

  class XrAware extends React.Component {
    constructor(props) {
      super(props)

      this.state = {
        xrSupportedSessionModes: [],
        xrSession: null,
        xrSessionMode: null,
        xrReferenceSpace: null,
        xrReferenceSpaceType: null
      }

      // bind handler methods:
      ;[
        '_checkXrSupport',
        '_startSession',
        '_stopSession'
      ].forEach(method => {
        this[method] = this[method].bind(this)
      })

      window.addEventListener('devicechange', this._checkXrSupport, false)
      this._checkXrSupport()
    }

    componentWillUnmount() {
      window.removeEventListener('devicechange', this._checkXrSupport, false)
    }

    _checkXrSupport() {
      const xr = navigator.xr
      if (xr) {
        const xrSupportedSessionModes = []
        Promise.all(options.sessionTypes.map(type => {
          return xr.supportsSession(type)
            .then(() => {
              xrSupportedSessionModes.push(type)
            })
            .catch(err => {
              console.log(`XR session type '${type}' not supported`, err)
            })
        })).then(() => {
          this.setState({xrSupportedSessionModes})
        })
      } else {
        this.setState({
          xrSupportedSessionModes: []
        })
      }
    }

    _startSession(xrSessionMode) {
      let {xrSupportedSessionModes, xrSession} = this.state
      if (xrSupportedSessionModes.includes(xrSessionMode)) {
        const doRequest = () => {
          navigator.xr.requestSession(xrSessionMode)
            .then(xrSession => {
              xrSession.addEventListener('end', this._stopSession, false)

              // Get the first XRReferenceSpace supported by the hardware - always include 'viewer' as a guaranteed fallback
              const candidateRefSpaces = (options.referenceSpaces || []).slice()
              if (!candidateRefSpaces.includes('viewer')) {
                candidateRefSpaces.push('viewer')
              }
              const getRefSpace = (index=0) => {
                const type = candidateRefSpaces[index]
                xrSession.requestReferenceSpace(type)
                  .then(xrReferenceSpace => [xrReferenceSpace, type])
                  .catch(err => {
                    console.log(`Failed requesting XRReferenceSpace '${type}'`, err)
                    if (index + 1 === candidateRefSpaces.length) {
                      console.error('All XRReferenceSpaces failed - should not happen!')
                      throw err
                    } else {
                      return getRefSpace(index + 1)
                    }
                  })
              }
              getRefSpace().then(([xrReferenceSpace, xrReferenceSpaceType]) => {
                this.setState({
                  xrSession,
                  xrSessionMode,
                  xrReferenceSpace,
                  xrReferenceSpaceType
                })
              })

            })
            .catch(err => {
              console.error(err)
              //TODO supply for user feedback... this.setState({xrSessionError: err})
            })
        }

        if (xrSession) {
          this._stopSession().then(doRequest)
        } else {
          doRequest()
        }
      }
    }

    _stopSession() {
      const {xrSession} = this.state.xrSession
      if (xrSession) {
        xrSession.removeEventListener('end', this._stopSession, false)
        return xrSession.end().then(() => {
          this.setState({
            xrSession: null,
            xrSessionMode: null
          })
        })
      }
      return Promise.resolve()
    }

    render() {
      const {props, state} = this
      const {xrSupportedSessionModes, xrSession, xrSessionMode, xrReferenceSpace, xrReferenceSpaceType} = state
      const xrSupported = xrSupportedSessionModes.length > 0

      const XrLauncherImpl = options.xrLauncherRenderer
      const xrLauncher = <XrLauncherImpl
        xrSupportedSessionModes={xrSupportedSessionModes}
        xrSupported={xrSupported}
        xrSession={xrSession}
        onRequestSessionType={this._startSession}
      />

      const contextValue = {
        worldClass: WorldXrFacade,
        worldProps: { xrSession, xrSessionMode }
      }

      return React.createElement(Canvas3D.contextType.Provider, {value: contextValue},
        React.createElement(
          ReactClass,
          utils.assign({}, props, {
            xrSupported,
            xrSupportedSessionModes,
            xrSession,
            xrSessionMode,
            xrReferenceSpace,
            xrReferenceSpaceType,
            xrLauncher
          }),
          props.children
        )
      )
    }
  }

  XrAware.displayName = `XrAware(${ReactClass.displayName || ReactClass.name || '?'})`

  return XrAware
}

