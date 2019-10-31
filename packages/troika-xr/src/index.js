// WebXR polyfill
//import WebXRPolyfill from 'webxr-polyfill'
if (self.WebXRPolyfill) {
  new WebXRPolyfill()
}

// Main entry point
export {makeVrAware} from './react/VrAware.jsx'
export {makeXrAware} from './webxr-wip/react/XrAware.jsx'

// Supporting facades
export {default as WorldVrFacade} from './facade/WorldVrFacade.js'
export {default as WorldXrFacade} from './webxr-wip/facade/WorldXrFacade.js'

// Controller models
export {default as OculusTouchModelFacade} from './facade/controllers/OculusTouchModelFacade.js'
export {default as BasicModelFacade} from './facade/controllers/BasicModelFacade.js'
