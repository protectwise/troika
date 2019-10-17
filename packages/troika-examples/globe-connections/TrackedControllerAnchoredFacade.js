import { Group3DFacade } from 'troika-3d'
import { Matrix4, Vector3, Quaternion } from 'three'



const tempPos1 = new Vector3()
const tempQuat1 = new Quaternion()
const tempScale1 = new Vector3()
const tempPos2 = new Vector3()
const tempQuat2 = new Quaternion()
const tempScale2 = new Vector3()
const cameraMat4 = new Matrix4()
const ctlrWorldMatrix = new Matrix4()


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

  /**
   * @property weight=1
   * If less than 1, represents a percentage interpolation between the object's "normal"
   * world transform and that of the controller. This allows things like animating/transitioning
   * an object toward the controller.
   */

  constructor(parent) {
    super(parent)

    this.hand = 'left'
    this.weight = 1

    this._wasTracked = false

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
            break
          }
        }
      }

      if (pose && camera && this.weight !== 0) {
        this._wasTracked = true

        // Build world matrix for controller:
        if (pose.position) {
          tempPos1.fromArray(pose.position)
        }
        tempQuat1.fromArray(pose.orientation)
        ctlrWorldMatrix.compose(tempPos1, tempQuat1, tempScale1.set(1, 1, 1))
        cameraMat4.compose(camera.position, camera.quaternion, camera.scale)
        ctlrWorldMatrix.premultiply(cameraMat4) //(pose is relative to camera)

        // If weighting, calculate a linear interpolation between the untransformed world
        // matrix and the contoller's:
        const weight = Math.min(1, Math.max(0, this.weight))
        if (weight < 1) {
          this._worldMatrixVersion = -1
          this.updateMatrices()
          this.threeObject.matrixWorld.decompose(tempPos2, tempQuat2, tempScale2)
          ctlrWorldMatrix.decompose(tempPos1, tempQuat1, tempScale1)
          tempPos2.lerp(tempPos1, weight)
          tempQuat2.slerp(tempQuat1, weight)
          tempScale2.lerp(tempScale1, weight)
          ctlrWorldMatrix.compose(tempPos2, tempQuat2, tempScale2)
        }

        this.threeObject.matrixWorld.copy(ctlrWorldMatrix)
      }
      else if (this._wasTracked) {
        this._wasTracked = false
        this._matrixChanged = true
        this.updateMatrices()
      }
    })
  }
}

