import { Mesh, MeshBasicMaterial, SphereBufferGeometry, Vector3, Quaternion } from 'three'
import {Object3DFacade} from 'troika-3d'

const cursorGeom = new SphereBufferGeometry()
const cursorMaterial = new MeshBasicMaterial({color: 0xffffff})
const tempVec3 = new Vector3()
const tempQuat = new Quaternion()
const degToRadMult = Math.PI / 180

class CursorFacade extends Object3DFacade {
  constructor(parent) {
    super(parent, new Mesh(
      cursorGeom,
      cursorMaterial.clone()
    ))

    /**
     * Visual size at which the cursor should be drawn, regardless of its distance.
     * This is measured in degrees of the field of view.
     * @type {number}
     */
    this.size = 0.3

    /**
     * If nonzero, defines the default distance at which the cursor should be displayed when
     * the targetRay does not intersect any pointable objects in the scene. Defaults to `0`,
     * which means it is hidden by default.
     * @type {number}
     */
    this.defaultDistance = 0
  }

  afterUpdate() {
    const {rayIntersection, defaultDistance, targetRayPose} = this

    // Only display if there is a valid ray intersection, or we're configured with a default distance
    let point = rayIntersection && rayIntersection.point
    if (!point && defaultDistance && targetRayPose) {
      point = tempVec3.set(0, 0, -1)
        .multiplyScalar(defaultDistance) //length
        .applyQuaternion(tempQuat.copy(targetRayPose.transform.orientation)) //rotation
        .add(targetRayPose.transform.position) //origin
    }
    if (point) {
      point.copy.call(this, point)
      this.scale = point.distanceTo(this.getCameraPosition()) * Math.sin(this.size * degToRadMult)
      this.visible = true
    } else {
      this.visible = false
    }

    super.afterUpdate()
  }
}

export default CursorFacade
