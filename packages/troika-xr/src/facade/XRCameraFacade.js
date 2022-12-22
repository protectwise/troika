/*global XRRigidTransform*/

import { Matrix4, PerspectiveCamera, Quaternion, Vector3, Vector4 } from 'three'
import { PerspectiveCamera3DFacade } from 'troika-3d'
import { utils } from 'troika-core'
import { invertMatrix4 } from 'troika-three-utils'

const tempVec3 = new Vector3()
const tempVec3b = new Vector3()
const tempQuat = new Quaternion()
const dummyObj = {}
const tempMat4 = new Matrix4()

function extendAsXRCamera (BaseCameraFacadeClass) {
  return doExtendAsXRCamera(BaseCameraFacadeClass || PerspectiveCamera3DFacade)
}

const doExtendAsXRCamera = utils.createClassExtender('xrCamera', function (BaseCameraFacadeClass) {
  return class XRCameraFacade extends BaseCameraFacadeClass {
    constructor (parent) {
      super(parent)

      // Required props
      this.xrSession = null
      this.xrReferenceSpace = null

      // This will behave like an ArrayCamera with a sub-camera for each view.
      // The individual view cameras will be created as needed based on the xrFrame's pose views.
      const mainCam = this.threeObject
      mainCam.isArrayCamera = true
      mainCam.cameras = []

      // Expose the camera's configured position/orientation as an offset XRReferenceSpace.
      this.offsetReferenceSpace = null

      // Update cameras on every render frame
      this.addEventListener('xrframe', this._onXrFrame.bind(this))
    }

    afterUpdate () {
      const { near, far, xrSession } = this

      // Update near/far planes
      const { depthNear, depthFar } = xrSession.renderState
      if (near !== depthNear || far !== depthFar) {
        xrSession.updateRenderState({
          depthNear: near,
          depthFar: far
        })
      }

      super.afterUpdate()
    }

    updateMatrices () {
      // Update offsetReferenceSpace to match configured camera position/rotation
      // TODO test if this reacts to reset events properly
      const { xrReferenceSpace } = this
      const offsetChanging = this._matrixChanged || xrReferenceSpace !== this._lastRefSpace
      super.updateMatrices()
      if (offsetChanging) {
        this._lastRefSpace = xrReferenceSpace
        invertMatrix4(this.threeObject.matrix, tempMat4).decompose(tempVec3, tempQuat, dummyObj)
        this.offsetReferenceSpace = xrReferenceSpace
          ? xrReferenceSpace.getOffsetReferenceSpace(new XRRigidTransform(tempVec3, tempQuat))
          : null
      }
    }

    /**
     * Handle syncing the cameras to the current XRFrame's pose data
     */
    _onXrFrame (timestamp, xrFrame) {
      const { xrSession, offsetReferenceSpace, threeObject: mainCam } = this
      const pose = offsetReferenceSpace && xrFrame.getViewerPose(offsetReferenceSpace)

      if (pose && xrSession && xrSession.renderState.baseLayer) {
        const views = pose.views
        const viewCameras = mainCam.cameras

        // Remove extra cameras if the count is decreasing
        while (viewCameras.length > views.length) {
          mainCam.layers.disable(viewCameras.length--)
        }

        // Update each eye view
        for (let i = 0; i < views.length; i++) {
          const view = views[i]
          let viewCam = viewCameras[i]

          // Create the view's sub-camera if needed
          if (!viewCam) {
            viewCam = viewCameras[i] = new PerspectiveCamera()
            viewCam.viewport = new Vector4()
            // Match the ThreeJS convention of layer masks per eye
            viewCam.layers.enable(i + 1)
            mainCam.layers.enable(i + 1)
          }

          // Update the sub-camera viewport and matrices to match the view
          const viewport = xrSession.renderState.baseLayer.getViewport(view)
          viewCam.viewport.set(viewport.x, viewport.y, viewport.width, viewport.height)
          viewCam.matrixWorld.fromArray(view.transform.matrix)
          viewCam.matrixWorldInverse.fromArray(view.transform.inverse.matrix)
          viewCam.projectionMatrix.fromArray(view.projectionMatrix)
        }

        // We also need to make the main camera match an overall pose/projection for use in
        // frustum culling etc. For now let's just copy the first view's data.
        // TODO this isn't good enough for the frustum, it results in overaggressive culling from the right eye.
        //  Should use a combined frustum once available from API (https://github.com/w3c/webvr/issues/203)
        //  or calculate it ourselves like ThreeJS does with WebVRUtils.setProjectionFromUnion
        if (views.length === 2) {
          setProjectionFromUnion(mainCam, viewCameras[0], viewCameras[1])
        }
      }
    }
  }
})

/**
 * NOTE: mostly copied from private function in ThreeJS's WebXRManager at
 * https://github.com/mrdoob/three.js/blob/f43ec7c849d7cecbc4831d152cf6a5d97c45ad3b/src/renderers/webxr/WebXRManager.js#L281
 *
 * Assumes 2 cameras that are parallel and share an X-axis, and that
 * the cameras' projection and world matrices have already been set.
 * And that near and far planes are identical for both cameras.
 * Visualization of this technique: https://computergraphics.stackexchange.com/a/4765
 */
function setProjectionFromUnion (camera, cameraL, cameraR) {

  tempVec3.setFromMatrixPosition(cameraL.matrixWorld)
  tempVec3b.setFromMatrixPosition(cameraR.matrixWorld)

  const ipd = tempVec3.distanceTo(tempVec3b)

  const projL = cameraL.projectionMatrix.elements
  const projR = cameraR.projectionMatrix.elements

  // VR systems will have identical far and near planes, and
  // most likely identical top and bottom frustum extents.
  // Use the left camera for these values.
  const near = projL[14] / (projL[10] - 1)
  const far = projL[14] / (projL[10] + 1)
  const topFov = (projL[9] + 1) / projL[5]
  const bottomFov = (projL[9] - 1) / projL[5]

  const leftFov = (projL[8] - 1) / projL[0]
  const rightFov = (projR[8] + 1) / projR[0]
  const left = near * leftFov
  const right = near * rightFov

  // Calculate the new camera's position offset from the
  // left camera. xOffset should be roughly half `ipd`.
  const zOffset = ipd / (-leftFov + rightFov)
  const xOffset = zOffset * -leftFov

  // TODO: Better way to apply this offset?
  cameraL.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale)
  camera.translateX(xOffset)
  camera.translateZ(zOffset)
  camera.matrixWorld.compose(camera.position, camera.quaternion, camera.scale)
  invertMatrix4(camera.matrixWorld, camera.matrixWorldInverse)

  // Find the union of the frustum values of the cameras and scale
  // the values so that the near plane's position does not change in world space,
  // although must now be relative to the new union camera.
  const near2 = near + zOffset
  const far2 = far + zOffset
  const left2 = left - xOffset
  const right2 = right + (ipd - xOffset)
  const top2 = topFov * far / far2 * near2
  const bottom2 = bottomFov * far / far2 * near2

  camera.projectionMatrix.makePerspective(left2, right2, top2, bottom2, near2, far2)
}

export { extendAsXRCamera }

