import { Group3DFacade } from 'troika-3d'
import { utils } from 'troika-core'
import BasicGrip from './grip-models/BasicGrip'
import OculusTouchGrip from './grip-models/OculusTouchGrip'
import { copyXRPoseToFacadeProps } from '../xrUtils'


const PROFILE_MODELS = [
  {
    match: /oculus-touch/,
    facade: OculusTouchGrip
  },
  {
    match: /.*/,
    facade: BasicGrip,
    space: 'targetRay'
  }
]

function findModelConfig(profiles) {
  for (let i = 0; i < PROFILE_MODELS.length; i++) {
    for (let j = 0; j < profiles.length; j++) {
      if (PROFILE_MODELS[i].match.test(profiles[j])) {
        const result = utils.assign({}, PROFILE_MODELS[i])
        delete result.match
        return result
      }
    }
  }
  return null
}


class GripFacade extends Group3DFacade {
  afterUpdate() {
    const {xrInputSource} = this
    let modelConfig = this.modelConfig
    if (xrInputSource && xrInputSource !== this._lastSource) {
      this._lastSource = xrInputSource
      modelConfig = this.modelConfig = findModelConfig(xrInputSource.profiles)
      modelConfig.xrInputSource = xrInputSource
    }

    // Update to match the appropriate pose
    if (modelConfig) {
      const pose = modelConfig.space === 'targetRay' ? this.targetRayPose : this.gripPose
      this.visible = !!pose
      if (pose) {
        copyXRPoseToFacadeProps(pose, this)
      }
      modelConfig.rayIntersection = this.rayIntersection
    }

    this.children = modelConfig || null
    super.afterUpdate()
  }
}

export default GripFacade
