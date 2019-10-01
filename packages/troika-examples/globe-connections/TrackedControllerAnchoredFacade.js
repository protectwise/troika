import { Group3DFacade } from 'troika-3d'
import { Matrix4, Vector3, Quaternion } from 'three'



const position = new Vector3()
const quaternion = new Quaternion()
const scale = new Vector3(1, 1, 1)
const cameraMat4 = new Matrix4()
const poseMat4 = new Matrix4()


/**
 * Experimental: Wrapper facade that syncs its world matrix to match that of a VR
 * hand controller when present.
 *
 * This feels inelegant; I'd like to have it hook in more cleanly to the existing
 * tracked controller facades if possible. Not sure how it should look.
 */
export default class TrackedControllerAnchoredFacade extends Group3DFacade {
  /**
   * @property hand='left'
   */

  // afterUpdate() {
  //   super.afterUpdate()
  // }

  constructor(parent) {
    super(parent)

    this._wasTracked = false
    this.hand = 'left' //default

    this.addEventListener('beforerender', () => {
      let pose
      const camera = this.getCameraFacade().threeObject
      const gamepads = navigator.getGamepads && navigator.getGamepads()
      if (gamepads) {
        for (let i = gamepads.length; i--;) {
          // Only include gamepads that match the active VRDisplay's id, and that are in use (have pose data).
          // Note: we don't use the `gamepad.connected` property as there's indication in other projects
          // that it is not accurate in some browsers, but we should verify that's still true.
          const gamepad = gamepads[i]
          if (gamepad && gamepad.hand === this.hand && gamepad.pose && gamepad.pose.orientation) {
            pose = gamepad.pose
          }
        }
      }

      if (pose && camera) {
        this._wasTracked = true
        if (pose.position) {
          position.fromArray(pose.position)
        }
        quaternion.fromArray(pose.orientation)
        poseMat4.compose(position, quaternion, scale)
        cameraMat4.compose(camera.position, camera.quaternion, camera.scale)
        poseMat4.premultiply(cameraMat4)
        poseMat4.decompose(this.threeObject.position, this.threeObject.quaternion, this.threeObject.scale)
        this.threeObject.updateMatrix()
        this.threeObject.updateMatrixWorld()
      }
      else if (this._wasTracked) {
        this._wasTracked = false
        this._matrixChanged = true
        this.afterUpdate()
      }
    })
  }
}

