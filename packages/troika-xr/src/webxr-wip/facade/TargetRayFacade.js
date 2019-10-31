import { Object3DFacade } from 'troika-3d'
import { copyPoseToFacadeProps } from '../xrUtils'
import { Mesh, MeshBasicMaterial, CylinderBufferGeometry } from 'three'

const MAX_LENGTH = 5

let getGeometry = () => {
  const geometry = new CylinderBufferGeometry(1, 1, 1, 4, 1, true)
    .translate(0, 0.5, 0)
    .rotateY(Math.PI / 4)
    .rotateX(Math.PI / -2)
  getGeometry = () => geometry
  return geometry
}

let getMaterial = () => {
  const material = new MeshBasicMaterial({
    transparent: true,
    opacity: 0.5,
    color: 0xffffff
  })
  getMaterial = () => material
  return material
}



class TargetRayFacade extends Object3DFacade {
  constructor(parent) {
    const mesh = new Mesh(getGeometry(), getMaterial())
    super(parent, mesh)

    this.radius = 0.003
  }

  afterUpdate() {
    if (this.targetRayPose) {
      // Position and orientation from the pose, but scale from radius/rayIntersection props
      this.scaleX = this.scaleY = this.radius
      this.scaleZ = this.rayIntersection ? Math.min(this.rayIntersection.distance, MAX_LENGTH) : MAX_LENGTH
      copyPoseToFacadeProps(this.targetRayPose, this)
      this.visible = true
    } else {
      this.visible = false
    }

    super.afterUpdate()
  }
}

export default TargetRayFacade
