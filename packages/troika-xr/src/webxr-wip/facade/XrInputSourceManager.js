import {Group3DFacade} from 'troika-3d'
import TrackedVrController from 'src/troika/packages/troika-xr/src/facade/TrackedVrControllerFacade'
import GazeVrController from 'src/troika/packages/troika-xr/src/facade/GazeVrControllerFacade'


/**
 * Single parent facade that monitors the available `XRInputSource`s and renders visual
 * representations within the scene as appropriate per the WebXR recommendations:
 *
 * |                   | Highlight | Cursor | Pointing Ray | Renderable Model |
 * | ------------------| --------- | ------ | ------------ | ---------------- |
 * | 'screen'          | √         | X      | X            | X                |
 * | 'gaze'            | √         | √      | X            | X                |
 * | 'tracked-pointer' | √         | √      | √            | √ (if possible)  |
 *
 * It also serves as a Group in the ThreeJS scene, with its world transform synchronized
 * to that of the camera object (minus the VR headset pose); each controller facade therefore only
 * has to manage its own local transform relative to the camera origin.
 *
 * In addition, it changes the standard lifecycle slightly so that the `afterUpdate()` phase
 * of it and its subtree is invoked on every VR frame, during the VR display's
 * `requestAnimationFrame` callback. This simplifies the implementation of `VrControllerFacade`s
 * by guaranteeing that their poses and parent matrix are all current and correct when their
 * `afterUpdate` logic is executed.
 */
export class XrInputSourceManager extends Group3DFacade {
  constructor(parent) {
    super(parent)
    this.addEventListener('xrframe', this._onXrFrame.bind(this))
    this.children = []
  }

  shouldUpdateChildren() {
    // Never update child controllers during the normal afterUpdate; they will instead be updated during
    // onBeforeRender since that's when the XRFrame info will be available.
    return false
  }

  _onXrFrame(xrFrame) {
    const {xrSession, children} = this
    children.length = 0

    // Sync the group container to the worldspace transform of the camera prior to headset pose;
    // this allows each controller to just maintain its own local pose transform
    this.threeObject.matrixWorld.compose(camera.position, camera.quaternion, camera.scale)

    // Add a tracked controller for each available gamepad
    if (xrSession) {


      /*const allGamepads = navigator.getGamepads && navigator.getGamepads()
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
      }*/
    }

    // // Use a single gaze controller as fallback
    // if (!children.length) {
    //   children.push({
    //     key: 'gaze',
    //     facade: GazeVrController
    //   })
    // }

    // Update the child controllers
    this.updateChildren(children)
  }
}

