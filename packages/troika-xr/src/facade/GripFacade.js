import { Group3DFacade } from 'troika-3d'
import { utils } from 'troika-core'
import BasicGrip from './grip-models/BasicGrip.js'
import OculusTouchGrip from './grip-models/OculusTouchGrip.js'
import { copyXRPoseToFacadeProps } from '../XRUtils.js'
//import { HandsGrip } from './grip-models/HandsGrip.js'


const PROFILE_MODELS = [
  /*{
    match: xrInputSource => {
      return true //TODO
    },
    facade: HandsGrip
  },*/
  {
    match: xrInputSource => {
      return /Oculus/.test(navigator.userAgent) || (
        xrInputSource.profiles && xrInputSource.profiles.some(profile => /oculus-touch/.test(profile))
      )
    },
    facade: OculusTouchGrip
  },
  {
    match: xrInputSource => true,
    facade: BasicGrip,
    space: 'targetRay'
  }
]

function findModelConfig(xrInputSource) {
  for (let i = 0; i < PROFILE_MODELS.length; i++) {
    if (PROFILE_MODELS[i].match(xrInputSource)) {
      const result = utils.assign({}, PROFILE_MODELS[i])
      delete result.match
      return result
    }
  }
}


class GripFacade extends Group3DFacade {
  afterUpdate() {
    const {xrInputSource} = this
    let modelConfig = this.modelConfig
    if (xrInputSource && xrInputSource !== this._lastSource) {
      this._lastSource = xrInputSource
      modelConfig = this.modelConfig = findModelConfig(xrInputSource)
      if (modelConfig) {
        modelConfig.xrInputSource = xrInputSource
      }
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
