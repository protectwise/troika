

export function copyPoseToFacadeProps(pose, facade) {
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
