import {arraysAreEqual} from '../../../utils'
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
  }

  _onBeforeRender(renderer, scene, camera) {
    // Poll for changes to the set of usable gamepads every so often.
    const now = Date.now()
    if (now - (this._lastCheckTime || 0) > gamepadCheckFrequency) {
      this._checkGamepads()
      this._lastCheckTime = now
    }

    // Sync the VrControllerManager group container to the worldspace transform of the camera prior to headset
    // pose; this allows each controller to just maintain its own local pose transform
    this.threeObject.matrixWorld.compose(camera.position, camera.quaternion, camera.scale)

    // Invoke afterUpdate of all controller facades on every frame
    this.forEachChild(invokeAfterUpdate)
  }

  shouldUpdateChildren() {
    // Never update children during normal afterUpdate, that will happen explicitly during
    // the onBeforeRender handler above.
    return false
  }

  _checkGamepads() {
    let gamepads = null
    if (this.vrDisplay) {
      const allGamepads = navigator.getGamepads && navigator.getGamepads()
      if (allGamepads) {
        for (let i = 0, len = allGamepads.length; i < len; i++) {
          const gamepad = allGamepads[i]
          // Only include gamepads that match the active VRDisplay's id, and that are in use (have pose data).
          // Note: we don't use the `gamepad.connected` property as there's indication in other projects
          // that it is not accurate in some browsers, but we should verify that's still true.
          if (gamepad && gamepad.displayId === this.vrDisplay.displayId && gamepad.pose && gamepad.pose.orientation) {
            (gamepads || (gamepads = [])).push(gamepad)
          }
        }
      }
    }

    // If the available gamepads changed in any way, update the child controller facade configs
    if (!arraysAreEqual(gamepads, this.gamepads)) {
      const controllerChildren = []

      // Add a tracked controller for each gamepad
      if (gamepads) {
        for (let i = 0, len = gamepads.length; i < len; i++) {
          controllerChildren.push({
            key: `tracked${i}`,
            facade: TrackedVrController,
            gamepad: gamepads[i],
            isPointing: i === len - 1
          })
        }
      }

      // Gaze controller as fallback
      if (!controllerChildren.length) {
        controllerChildren.push({
          key: 'gaze',
          facade: GazeVrController
        })
      }

      this.gamepads = gamepads
      this.updateChildren(controllerChildren)
      this.afterUpdate() //in case any children were removed, this will sync the threejs scene
    }
  }
}

function invokeAfterUpdate(f) {
  f.afterUpdate()
}


