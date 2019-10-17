/**
 * Decorator wrapper for Camera facade classes that enhances them to render in VR. The
 * scene's configured camera facade will be automatically wrapped with this if there
 * is a `vrDisplay` currently presenting.
 *
 * Much of this is a direct mirror of the logic in ThreeJS's built-in `WebVRManager`, but
 * we replicate it here ourselves and bypass `WebVRManager` for a couple of reasons:
 *
 * 1) The `WebVRManager` currently makes some odd assumptions about its usage, clobbering
 *    the base camera's configured transform with that of the pose. We want to honor the
 *    configured transform as a base origin and then tack on the pose transform as a local
 *    adjustment, to allow e.g. navigation of the camera through the world.
 *
 * 2) It's sometimes useful for code elsewhere in the scene to be aware of the pose
 *    transformation. For example, `Camera3DFacade.getFrustum()` is able to match the
 *    user's actual posed view, which it wouldn't be able to otherwise.
 */

import { Matrix4, PerspectiveCamera, Quaternion, Ray, Raycaster, Vector2, Vector3, Vector4 } from 'three'
import { utils } from 'troika-core'

const tempMat4 = new Matrix4()
const tempQuat = new Quaternion()
const tempVec2 = new Vector2()
const tempVec3 = new Vector3()
const tempRaycaster = new Raycaster()


export const extendAsVrCamera = utils.createClassExtender('vrCamera', function(BaseCamFacadeClass) {
  class VrCamera extends BaseCamFacadeClass {
    constructor(parent) {
      super(parent)

      // Make it behave like an ArrayCamera with left/right eye cameras
      const leftCam = new PerspectiveCamera()
      leftCam.viewport = new Vector4()

      const rightCam = new PerspectiveCamera()
      rightCam.viewport = new Vector4()

      const mainCam = this.threeObject
      mainCam.isArrayCamera = true
      mainCam.cameras = [leftCam, rightCam]

      // Match the ThreeJS convention of letting objects use layer masks 1 and 2 to
      // confine themselves to only the left or right camera
      leftCam.layers.enable(1)
      rightCam.layers.enable(2)
      mainCam.layers.enable(1)
      mainCam.layers.enable(2)

      // Update matrices on every render frame
      this.addEventListener('beforerender', this.updateMatrices.bind(this))

      this.vrDisplay = null
      this._frameData = new VRFrameData()
    }

    /**
     * @override
     * Handle syncing the VR eye cameras and parent camera to the current pose and VR display parameters
     */
    updateMatrices() {
      const vrDisplay = this.vrDisplay
      if (vrDisplay && vrDisplay.isPresenting) {
        const mainCam = this.threeObject

        vrDisplay.depthNear = mainCam.near
        vrDisplay.depthFar = mainCam.far

        const frameData = this._frameData
        const gotFrameData = vrDisplay.getFrameData(frameData)

        // Only update the matrices if we got new VR pose data or the main camera was moved
        if (gotFrameData || this._matrixChanged) {
          const [leftCam, rightCam] = mainCam.cameras

          // Force update the array camera's world matrix as configured by user
          this._matrixChanged = true
          super.updateMatrices()

          // Sync eye cameras; note the eye matrices include the pose transform so we do this prior to
          // applying the pose transform to the main camera.
          const {renderWidth, renderHeight} = vrDisplay.getEyeParameters('left') //meh feels like fragile assumption but can't get actual px viewports for both eyes
          syncEye(
            mainCam, leftCam,
            frameData.leftViewMatrix, frameData.leftProjectionMatrix,
            0, 0, renderWidth, renderHeight
          )
          syncEye(
            mainCam, rightCam,
            frameData.rightViewMatrix, frameData.rightProjectionMatrix,
            renderWidth, 0, renderWidth, renderHeight
          )

          // The eye cameras now match the pose, but we also need to make the main camera match
          // an overall pose/projection for use in frustum culling etc.
          const pose = frameData.pose
          tempMat4.makeRotationFromQuaternion(tempQuat.fromArray(pose.orientation || [0,0,0,1]))
          tempMat4.setPosition(tempVec3.fromArray(pose.position || [0,0,0]))
          mainCam.matrixWorld.multiply(tempMat4)
          mainCam.matrixWorldInverse.getInverse(mainCam.matrixWorld)

          // Use the projection matrix of the left eye for overall frustum calc
          // TODO this isn't good enough, it results in overaggressive culling from the right eye
          // TODO use combined frustum once available from API (https://github.com/w3c/webvr/issues/203) or calculate it ourselves
          mainCam.projectionMatrix.copy(leftCam.projectionMatrix)
        }
      } else {
        console.log('not presenting')
        super.updateMatrices()
      }
    }

    /**
     * @override
     * Allow accurate raycasting from both eye projection areas, by choosing the left/right camera
     */
    getRayAtProjectedCoords(u, v) {
      // TODO handle non-default eye bounds?
      const eyeCam = this.threeObject.cameras[u < 0 ? 0 : 1]
      if (u < 0) u += 1
      u = (2 * u) - 1
      const ray = tempRaycaster.ray = new Ray()
      tempRaycaster.setFromCamera(tempVec2.set(u, v), eyeCam)
      return ray
    }
  }

  return VrCamera
})


function syncEye(mainCam, eyeCam, eyeViewMatrix, eyeProjMatrix, x, y, width, height) {
  eyeCam.viewport.set(x, y, width, height)
  eyeCam.near = mainCam.near
  eyeCam.far = mainCam.far
  eyeCam.matrixWorldInverse.multiplyMatrices(tempMat4.fromArray(eyeViewMatrix), mainCam.matrixWorldInverse)
  eyeCam.matrixWorld.getInverse(eyeCam.matrixWorldInverse)
  eyeCam.projectionMatrix.fromArray(eyeProjMatrix)
}




function getCombinedProjectionMatrix(centerCam, leftCam, rightCam) {
  // Calculate eacy eye's offset matrix from the center

  // Unproject points to find all the corners of both eye frusta relative to the center

  // Choose the outermost points to build a largest possible frustum
}


