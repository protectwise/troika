import { PerspectiveCamera, Vector4, Vector3, Quaternion } from 'three'
import { PerspectiveCamera3DFacade } from 'troika-3d'

const tempVec3 = new Vector3()
const tempQuat = new Quaternion()


class XrCameraFacade extends PerspectiveCamera3DFacade {
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

    // Expose the camera's configured position/orientation as an XRRigidTransform.
    // This can be used with getOffsetReferenceSpace to get a camera-relative reference space.
    this.xrOffsetTransform = new XRRigidTransform()

    // Update cameras on every render frame
    this.addEventListener('xrframe', this._onXrFrame.bind(this))
  }


  afterUpdate() {
    const {near, far, xrSession, threeObject} = this

    // Update near/far planes
    const {depthNear, depthFar} = xrSession.renderState
    if (near !== depthNear || far !== depthFar) {
      xrSession.updateRenderState({
        depthNear: near,
        depthFar: far
      })
    }

    // Update a rigid transform for the camera's world offset
    // TODO should we force y=0 for floor-relative spaces?
    // TODO this needs testing outside the webxr emulator extension which doesn't support pose offsets
    if (this._matrixChanged) {
      this.xrOffsetTransform = new XRRigidTransform(
        tempVec3.copy(threeObject.position).negate(),
        tempQuat.copy(threeObject.quaternion).inverse()
      )
    }

    super.afterUpdate()
  }


  /**
   * Handle syncing the cameras to the current XRFrame's pose data
   */
  _onXrFrame(timestamp, xrFrame) {
    const {xrSession, xrReferenceSpace, threeObject:mainCam} = this

    // Update reference space offset to match configured camera position/rotation
    // We do this every frame because impls may slightly change the base space from frame
    // to frame without firing a reset event.
    const offsetSpace = xrReferenceSpace.getOffsetReferenceSpace(this.xrOffsetTransform)
    const pose = xrFrame.getViewerPose(offsetSpace)

    if (pose && xrSession && xrReferenceSpace && xrSession.renderState.baseLayer) {
      const views = pose.views
      const viewCameras = mainCam.cameras

      // Remove extra cameras if the count is decreasing
      while (viewCameras.length > views.length) {
        mainCam.layers.disable(viewCameras.length--)
      }

      // Force update the array camera's world matrix and inverse world matrix to match the
      // user-configured transform - this gives us a baseline worldspace origin for all poses
      //mainCam.updateWorldMatrix()

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
        viewCam.matrixWorld.fromArray(view.transform.matrix)//.multiply(mainCam.matrixWorld)
        // viewCam.matrixWorldInverse.getInverse(viewCam.matrixWorld)
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

  // TODO is this relevant in WebXR if it doesn't mirror to the original canvas on screen?
  // /**
  //  * @override
  //  * Allow accurate raycasting from both eye projection areas, by choosing the left/right camera
  //  */
  // getRayAtProjectedCoords(u, v) {
  //   // TODO handle non-default eye bounds?
  //   const eyeCam = this.threeObject.cameras[u < 0 ? 0 : 1]
  //   if (u < 0) u += 1
  //   u = (2 * u) - 1
  //   const ray = tempRaycaster.ray = new Ray()
  //   tempRaycaster.setFromCamera(tempVec2.set(u, v), eyeCam)
  //   return ray
  // }
}


export default XrCameraFacade

