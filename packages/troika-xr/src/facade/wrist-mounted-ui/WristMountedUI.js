import { Facade, Group3DFacade } from 'troika-3d'
import {
  Matrix4,
  Quaternion,
  Vector3
} from 'three'
import { Wristband } from './Wristband.js'
import { ContentContainer } from './ContentContainer.js'

const tempMat4 = new Matrix4()
const tempQuat = new Quaternion()
const tempVec3 = new Vector3()
const upVec3 = new Vector3(0, 1, 0)


/**
 * This facade provides a container for arbitrary global UI, which is hidden by default
 * but is easily brought up by a simple gesture. A wristband is added to one of the hand
 * controllers, with an icon affordance on the inner wrist. When that icon is turned
 * upwards, the UI is projected from it.
 *
 * @property {('left'|'right')} preferredHand - which hand the wristband should appear on.
 */
export class WristMountedUI extends Group3DFacade {
  constructor (parent) {
    super(parent)
    // Config:
    this.activeUpAngle = Math.PI / 7
    this.preferredHand = 'left'
    this.platformRadius = 0.25
    this.platformColor = 0x333333
    this.projectionColor = 0x3399ff
    this.keepContentAlive = false
    this.onActiveChange = null

    // Internal state:
    this.gripPose = null
    this.active = false

    this._cogPos = new Vector3()
    this.addEventListener('xrframe', this.onXRFrame.bind(this))
  }

  describeChildren () {
    // Only render children if we have a valid gripPose
    if (!this.gripPose) {
      return null
    }

    let children = this._childTpl || (this._childTpl = [
      {
        key: 'wristband',
        facade: Wristband,
        active: false,
        gripPose: null,
        onCogMove: (worldPos) => {
          this._cogPos.copy(worldPos)
        }
      },
      {
        key: 'content',
        facade: ContentContainer,
        active: false,
        gripPose: null,
        children: null
      }
    ])

    let [wristbandDef, contentDef] = children
    wristbandDef.active = contentDef.active = this.active
    //wristbandDef.gripPose = contentDef.gripPose = this.gripPose
    contentDef.platformRadius = this.platformRadius
    contentDef.platformColor = this.platformColor
    contentDef.projectionColor = this.projectionColor
    contentDef.projectionSourcePosition = this._cogPos
    contentDef.keepContentAlive = this.keepContentAlive
    contentDef.children = this.children

    return children
  }

  updateMatrices() {
    // Force matrix to match that of the camera's pre-pose transform
    this.threeObject.matrixWorld.copy(this.getCameraFacade().threeObject.matrix)
    this.markWorldMatrixDirty()
  }

  onXRFrame (time, xrFrame) {
    let gripPose = null
    let active = false
    let inputSources = xrFrame.session.inputSources
    if (inputSources) {
      let gripSpace = null
      for (let i = 0, len = inputSources.length; i < len; i++) {
        if (inputSources[i].handedness === this.preferredHand) {
          gripSpace = inputSources[i].gripSpace
          break
        }
      }
      if (gripSpace) {
        // Calculate grip pose so we can pass it down to the Wristband
        // Note: the gripPose will be relative to this object's matrix, which is synced to the
        // camera's base position. This simplifies child transform calculations because you can
        // treat them always as relative to default position/orientation.
        let cam = this.getCameraFacade()
        gripPose = xrFrame.getPose(gripSpace, cam.xrReferenceSpace)
        if (gripPose) {
          // If turned to upward angle, set to active
          // TODO: needs debouncing!
          tempVec3.set(1, 0, 0).applyQuaternion(
            tempQuat.setFromRotationMatrix(tempMat4.fromArray(gripPose.transform.matrix))
          )
          active = tempVec3.angleTo(upVec3) < this.activeUpAngle
        }
      }
    }

    if (active !== this.active) {
      if (this.onActiveChange) {
        this.onActiveChange(active)
      }
      this.update({active})
    }

    if (!!gripPose !== !!this.gripPose) {
      this.update({gripPose})
    }
    else if (gripPose) {
      // Skip full afterUpdate pass, just give the gripPose to children - they both have
      // a syncPose method to handle syncing matrices without a full afterUpdate.
      this.forEachChild(child => child.syncPose(gripPose))
    }
  }
}
