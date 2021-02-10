//=== WebXR: ===//

// Main entry point
export {ReactXRAware, XRAwarePropTypes} from './react/XRAware.js'

// Supporting facades
export {default as WorldXRFacade} from './facade/WorldXRFacade.js'
export {extendAsXRCamera} from './facade/XRCameraFacade.js'

// Input Sources
export {default as XRInputSourceFacade} from './facade/XRInputSourceFacade.js'
export {default as CursorFacade} from './facade/CursorFacade.js'
export {default as GripFacade} from './facade/GripFacade.js'
export {default as TargetRayFacade} from './facade/TargetRayFacade.js'
export * from './XRStandardGamepadMapping.js'

// Controller Grip Models
export {default as BasicGrip} from './facade/grip-models/BasicGrip.js'
export {default as OculusTouchGrip} from './facade/grip-models/OculusTouchGrip.js'

// Wrist Mounted UI Container
export {WristMountedUI} from './facade/wrist-mounted-ui/WristMountedUI.js'

// Teleport Controls
export {TeleportControls} from './facade/teleport/TeleportControls.js'

// Misc
export * from './XRUtils.js'
