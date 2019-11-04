// WebXR polyfill
//import WebXRPolyfill from 'webxr-polyfill'
if (self.WebXRPolyfill) {
  new WebXRPolyfill()
}

//=== WebVR: ===//

// Main entry point
export {makeVrAware} from './react/VrAware.jsx'

// Supporting facades
export {default as WorldVrFacade} from './facade/WorldVrFacade.js'

// Controller models
export {default as OculusTouchModelFacade} from './facade/controllers/OculusTouchModelFacade.js'
export {default as BasicModelFacade} from './facade/controllers/BasicModelFacade.js'


//=== WebXR: ===//

// Main entry point
export {makeXrAware} from './webxr-wip/react/XrAware.jsx'

// Supporting facades
export {default as WorldXrFacade} from './webxr-wip/facade/WorldXrFacade.js'

// Input Sources
export {default as XrInputSourceFacade} from './webxr-wip/facade/XrInputSourceFacade.js'
export {default as CursorFacade} from './webxr-wip/facade/CursorFacade.js'
export {default as GripFacade} from './webxr-wip/facade/GripFacade.js'
export {default as TargetRayFacade} from './webxr-wip/facade/TargetRayFacade.js'
export * from './webxr-wip/xrStandardGamepadMapping.js'

// Controller Grip Models
export {default as BasicGrip} from './webxr-wip/facade/grip-models/BasicGrip.js'
export {default as OculusTouchGrip} from './webxr-wip/facade/grip-models/OculusTouchGrip.js'

// Misc
export * from './webxr-wip/xrUtils.js'
