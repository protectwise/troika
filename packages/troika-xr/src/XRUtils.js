/**
 * Given a XRPose, copy its transform's position and orientation to the corresponding
 * properties on a Object3DFacade.
 * @param {XRPose} pose
 * @param {Object3DFacade} facade
 */
export function copyXRPoseToFacadeProps(pose, facade) {
  if (pose && facade) {
    const {position, orientation} = pose.transform
    facade.x = position.x
    facade.y = position.y
    facade.z = position.z
    facade.quaternionX = orientation.x
    facade.quaternionY = orientation.y
    facade.quaternionZ = orientation.z
    facade.quaternionW = orientation.w
  }
}
