import { Matrix4, PerspectiveCamera, Vector4, Vector3, Quaternion } from 'three'
import { PerspectiveCamera3DFacade } from 'troika-3d'
import { utils } from 'troika-core'

const tempVec3 = new Vector3()
const tempQuat = new Quaternion()
const dummyObj = {}
const tempMat4 = new Matrix4()

function extendAsXRCamera(BaseCameraFacadeClass) {
  return doExtendAsXRCamera(BaseCameraFacadeClass || PerspectiveCamera3DFacade)
}

const doExtendAsXRCamera = utils.createClassExtender('xrCamera', function(BaseCameraFacadeClass) {
  return class XRCameraFacade extends BaseCameraFacadeClass {
    constructor(parent) {
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


    afterUpdate() {
      const {near, far, xrSession, xrReferenceSpace, threeObject} = this

      // Update near/far planes
      const {depthNear, depthFar} = xrSession.renderState
      if (near !== depthNear || far !== depthFar) {
        xrSession.updateRenderState({
          depthNear: near,
          depthFar: far
        })
      }

      super.afterUpdate()
    }

    updateMatrices() {
      // Update offsetReferenceSpace to match configured camera position/rotation
      // TODO test if this reacts to reset events properly
      const {xrReferenceSpace} = this
      const offsetChanging = this._matrixChanged || xrReferenceSpace !== this._lastRefSpace
      super.updateMatrices()
      if (offsetChanging) {
        this._lastRefSpace = xrReferenceSpace
        tempMat4.getInverse(this.threeObject.matrix).decompose(tempVec3, tempQuat, dummyObj)
        this.offsetReferenceSpace = xrReferenceSpace
          ? xrReferenceSpace.getOffsetReferenceSpace(new XRRigidTransform(tempVec3, tempQuat))
          : null
      }
    }


    /**
     * Handle syncing the cameras to the current XRFrame's pose data
     */
    _onXrFrame(timestamp, xrFrame) {
      const {xrSession, offsetReferenceSpace, threeObject:mainCam} = this
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
        if (viewCameras[0]) {
          mainCam.matrixWorld.copy(viewCameras[0].matrixWorld)
          mainCam.matrixWorldInverse.copy(viewCameras[0].matrixWorldInverse)
          mainCam.projectionMatrix.copy(viewCameras[0].projectionMatrix)
        }
      }
    }
  }
})


export { extendAsXRCamera }

