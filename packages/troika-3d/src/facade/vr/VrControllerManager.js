import Group3DFacade from '../Group3DFacade'
import TrackedVrController from './TrackedVrControllerFacade'
import GazeVrController from './GazeVrControllerFacade'

const gamepadCheckFrequency = 1000

/**
 * Single parent facade that manages the creation and updating of one or more `VrControllerFacade`
 * children depending on what's available in the current environment. It uses the Gamepad API to
 * manage a `TrackedVrControllerFacade` for each available hand controller, or a single
 * `GazeVrControllerFacade` as a fallback when no hand controllers are available.
 *
 * This manager also serves as a Group in the ThreeJS scene, with its world transform synchronized
 * to that of the camera object (minus the VR headset pose); each controller facade therefore only
 * has to manage its own local transform relative to the camera origin.
 *
 * In addition, it changes the standard lifecycle slightly so that the `afterUpdate()` phase
 * of it and its subtree is invoked on every VR frame, during the VR display's
 * `requestAnimationFrame` callback. This simplifies the implementation of `VrControllerFacade`s
 * by guaranteeing that their poses and parent matrix are all current and correct when their
 * `afterUpdate` logic is executed.
 */
export class VrControllerManager extends Group3DFacade {
  constructor(parent) {
    super(parent)
    this.addEventListener('beforerender', this._onBeforeRender.bind(this))
    this._isInRenderFrame = false
    this.children = []
  }

  shouldUpdateChildren() {
    // Only allow child controllers to be updated during render frames (onBeforeRender), since
    // that's when the VR display and gamepad objects will be queryable and current.
    return this._isInRenderFrame
  }

  _onBeforeRender(renderer, scene, camera) {
    const {vrDisplay, children} = this
    children.length = 0

    // Sync the VrControllerManager group container to the worldspace transform of the camera prior
    // to headset pose; this allows each controller to just maintain its own local pose transform
    this.threeObject.matrixWorld.compose(camera.position, camera.quaternion, camera.scale)

    // Add a tracked controller for each available gamepad
    if (vrDisplay) {
      const allGamepads = navigator.getGamepads && navigator.getGamepads()
      if (allGamepads) {
        for (let i = allGamepads.length; i--;) { //iterate backwards so first encountered is primary
          const gamepad = allGamepads[i]
          // Only include gamepads that match the active VRDisplay's id, and that are in use (have pose data).
          // Note: we don't use the `gamepad.connected` property as there's indication in other projects
          // that it is not accurate in some browsers, but we should verify that's still true.
          if (gamepad && gamepad.displayId === vrDisplay.displayId && gamepad.pose && gamepad.pose.orientation) {
            children.push({
              key: `tracked${i}`,
              facade: TrackedVrController,
              gamepad,
              isPointing: !children.length
            })
          }
        }
      }
    }

    // Use a single gaze controller as fallback
    if (!children.length) {
      children.push({
        key: 'gaze',
        facade: GazeVrController
      })
    }

    this._isInRenderFrame = true
    this.afterUpdate()
    this._isInRenderFrame = false
  }
}

