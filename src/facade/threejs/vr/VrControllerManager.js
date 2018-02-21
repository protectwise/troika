import {arraysAreEqual} from '../../../utils'
import Group3DFacade from '../Group3DFacade'
import TrackedVrController from './TrackedVrControllerFacade'
import GazeVrController from './GazeVrControllerFacade'




const gamepadCheckFrequency = 1000


export class VrControllerManager extends Group3DFacade {
  constructor(parent) {
    super(parent)
    this.onBeforeRender = this.onBeforeRender.bind(this)
  }

  onBeforeRender(renderer, scene, camera) {
    // Poll for changes to the set of usable gamepads every so often.
    const now = Date.now()
    if (now - (this._lastCheckTime || 0) > gamepadCheckFrequency) {
      this._checkGamepads()
      this._lastCheckTime = now
    }

    // Sync the VrControllerManager group container to the worldspace transform of the camera prior to headset
    // pose; this allows each controller to just maintain its own local pose transform
    this.threeObject.matrixWorld.compose(camera.position, camera.quaternion, camera.scale)
  }

  afterUpdate() {
    const controllerChildren = []

    const {gamepads} = this
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

    // Add a fallback gaze controller
    if (!controllerChildren.length) {
      controllerChildren.push({
        key: 'gaze',
        facade: GazeVrController
      })
    }

    this.children = controllerChildren
    super.afterUpdate()
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
    if (!arraysAreEqual(gamepads, this.gamepads)) {
      this.gamepads = gamepads
      this.afterUpdate()
    }
  }
}


