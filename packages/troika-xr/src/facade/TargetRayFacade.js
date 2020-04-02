import { Object3DFacade, createDerivedMaterial } from 'troika-3d'
import { copyXRPoseToFacadeProps, TARGET_RAY_RENDERORDER } from '../XRUtils.js'
import { Group, Mesh, MeshBasicMaterial, CylinderBufferGeometry } from 'three'


let getGeometry = () => {
  const geometry = new CylinderBufferGeometry(1, 1, 1, 4, 1, false)
    .translate(0, 0.5, 0)
    .rotateY(Math.PI / 4)
    .rotateX(Math.PI / -2)
  getGeometry = () => geometry
  return geometry
}

let getMaterial = () => {
  const material = createDerivedMaterial(
    new MeshBasicMaterial({
      transparent: true,
      opacity: 0.5,
      color: 0xffffff,
      depthTest: false
    }), {
      vertexDefs: `varying float dist;`,
      vertexMainIntro: `dist = -position.z;`,
      fragmentDefs: `varying float dist;`,
      fragmentColorTransform: `gl_FragColor.a *= smoothstep(1.0, 0.6, dist);`
    }
  )
  getMaterial = () => material
  return material
}



class TargetRayFacade extends Object3DFacade {
  constructor(parent) {
    super(parent, new Group())

    this.threeObject.add(this.laserMesh = new Mesh(getGeometry(), getMaterial()))

    this.radius = 0.003
    this.startDistance = 0.05
    this.maxLength = 0.4
    this.renderOrder = TARGET_RAY_RENDERORDER
  }

  afterUpdate() {
    const {laserMesh, targetRayPose, radius, rayIntersection, startDistance, maxLength} = this
    if (targetRayPose) {
      // Sync group to the targetRay pose
      copyXRPoseToFacadeProps(targetRayPose, this)

      // Update laser size from radius/rayIntersection props
      laserMesh.scale.set(
        radius,
        radius,
        (rayIntersection ? Math.min(rayIntersection.distance, maxLength) : maxLength) - startDistance
      )
      laserMesh.position.z = -startDistance
      laserMesh.visible = true
    } else {
      laserMesh.visible = false
    }

    super.afterUpdate()
  }
}

export default TargetRayFacade
