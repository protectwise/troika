import { Group3DFacade } from 'troika-3d'
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
    this.active = false
    this.activeUpAngle = Math.PI / 7
    this.preferredHand = 'left'

    this.addEventListener('xrframe', this.onXRFrame.bind(this))
  }

  describeChildren () {
    let children = this._childTpl || (this._childTpl = [
      {
        key: 'wristband',
        facade: Wristband,
        active: false,
        gripPose: null
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
    wristbandDef.gripPose = contentDef.gripPose = this.gripPose
    contentDef.children = this.children

    return children
  }

  onXRFrame (time, xrFrame) {
    let gripPose = null
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
        gripPose = xrFrame.getPose(gripSpace, this.getCameraFacade().offsetReferenceSpace)

        // If turned to upward angle, set to active
        // TODO: needs debouncing!
        tempVec3.set(1, 0, 0).applyQuaternion(
          tempQuat.setFromRotationMatrix(tempMat4.fromArray(gripPose.transform.matrix))
        )
        this.active = tempVec3.angleTo(upVec3) < this.activeUpAngle
      }
    }

    if (gripPose || !this.gripPose) {
      this.gripPose = gripPose
      this.afterUpdate()
    }
  }

}
