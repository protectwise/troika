import { Group3DFacade } from 'troika-3d'
import { Matrix4, Vector3, Quaternion } from 'three'



const tempPos1 = new Vector3()
const tempQuat1 = new Quaternion()
const tempScale1 = new Vector3()
const tempPos2 = new Vector3()
const tempQuat2 = new Quaternion()
const tempScale2 = new Vector3()
const tempMat4 = new Matrix4()


/**
 * Experimental: Wrapper facade that syncs its world matrix to match that of a
 * tracked-pointer XRInputSource when the user presses its "squeeze" button.
 */
export default class XRGrabbable extends Group3DFacade {
  constructor(parent) {
    super(parent)

    this.grabber = null
    this.grabbedAmount = 0
    this.gripSpaceTransform = null

    this._lastGripPose = null

    this.addEventListener('xrsqueezestart', this._onSqueezeStart.bind(this))
    this.addEventListener('beforerender', this._onBeforeRender.bind(this))
    this._onSqueezeEnd = this._onSqueezeEnd.bind(this)
  }

  _onSqueezeStart(e) {
    if (e.eventSource) {
      this.grabber = e.eventSource
      this.grabbedAmount = 1
      this.getSceneFacade().addEventListener('xrsqueezeend', this._onSqueezeEnd)
    }
  }

  _onSqueezeEnd(e) {
    if (e.eventSource === this.grabber) {
      this.grabber = null
      this.grabbedAmount = 0
      this.getSceneFacade().removeEventListener('xrsqueezeend', this._onSqueezeEnd)
    }
  }

  updateMatrices () {
    const gripPose = this._lastGripPose
    const weight = gripPose && Math.min(1, Math.max(0, this.grabbedAmount))
    if (gripPose && weight) {
      tempMat4.fromArray(gripPose.transform.matrix)
      // Apply grip space transform if supplied
      const {gripSpaceTransform} = this
      if (gripSpaceTransform && gripSpaceTransform.isMatrix4) {
        tempMat4.multiply(gripSpaceTransform)
      }
      // If weighting, calculate a linear interpolation between the untransformed world
      // matrix and the grabbing XRInputSource's pose
      if (weight < 1) {
        this._worldMatrixVersion = -1
        super.updateMatrices()
        this.threeObject.matrixWorld.decompose(tempPos2, tempQuat2, tempScale2)
        tempMat4.decompose(tempPos1, tempQuat1, tempScale1)
        tempPos2.lerp(tempPos1, weight)
        tempQuat2.slerp(tempQuat1, weight)
        tempScale2.lerp(tempScale1, weight)
        tempMat4.compose(tempPos2, tempQuat2, tempScale2)
      }
      this.threeObject.matrixWorld.copy(tempMat4)
      this.markWorldMatrixDirty()
    } else {
      super.updateMatrices()
    }
  }

  _onBeforeRender() {
    const grabber = this.grabber
    if (grabber && grabber.gripPose) {
      this._lastGripPose = grabber.gripPose
    }
    if (this.grabbedAmount > 0) {
      this.afterUpdate()
    }
  }

  destructor () {
    this.getSceneFacade().removeEventListener('xrsqueezeend', this._onSqueezeEnd)
    super.destructor()
  }
}

