import { Object3DFacade } from 'troika-3d'
import { Group, Plane, Quaternion, Sphere, Vector3 } from 'three'
import { GroundTarget } from './GroundTarget.js'

const raycastPlane = new Plane().setComponents(0, 1, 0, 0)
const tempVec3 = new Vector3()
const tempQuat = new Quaternion()
const infiniteSphere = new Sphere(undefined, Infinity)

/**
 * Basic teleportation. Add an instance of this facade anywhere in the scene.
 * The user can point-drag an XR pointer ray at the ground plane and be
 * teleported to that location when releasing. They can use a thumbstick while
 * targeting a ground location to set the resulting orientation direction. Also,
 * using the thumbstick while not targeting the ground will snap-rotate the view
 * by 45 degrees.
 *
 * It must be given a `onTeleport` callback function, which will be called with
 * an object holding `{position: {xPos, zPos}, rotation: yRot}`. These can then
 * be applied to the scene's `camera` config as the new camera reference origin.
 *
 * Currently this implementation only supports teleporting along the x-z plane
 * at y=0.
 */
export class TeleportControls extends Object3DFacade {
  constructor (parent) {
    super(parent, new Group())

    this.maxDistance = 10
    this.targeting = false
    this.onTeleport = null

    let markerConfig = this.markerConfig = {
      key: 'marker',
      facade: GroundTarget,
      'material.color': 0x003399,
      visible: false
    }
    this.children = [
      markerConfig
    ]

    let lastAxisAngle = 0
    this.addEventListener('dragstart', e => {
      lastAxisAngle = 0
      this.targeting = true
      this.afterUpdate()
    })
    this.addEventListener('drag', e => {
      if (this.targeting) {
        let point = e.ray.intersectPlane(raycastPlane, tempVec3)
        if (point && point.distanceTo(this.getCameraPosition()) < this.maxDistance) {
          this.targeting = true
          markerConfig.x = tempVec3.x
          markerConfig.z = tempVec3.z
          this.requestRender()
          // For rotation, start with the current direction of the camera. Then rotate
          // relative to that by the last controller stick/axis position.
          tempQuat.setFromRotationMatrix(this.getCameraFacade().threeObject.matrixWorld)
          tempVec3.set(0, 0, -1).applyQuaternion(tempQuat)
          markerConfig.rotateY = Math.atan2(-tempVec3.x, -tempVec3.z) + lastAxisAngle
        } else {
          this.targeting = false
        }
        this.afterUpdate()
      }
    })
    this.addEventListener('dragend', e => {
      if (this.targeting) {
        this.targeting = false
        this.afterUpdate()
        this.onTeleport({
          position: { x: markerConfig.x, z: markerConfig.z },
          rotation: markerConfig.rotateY
        })
      }
    })

    const rotateDebounce = 500
    const rotateBy = Math.PI / -4
    let lastRotateTime = 0
    this.addEventListener('wheel', e => {
      if (this.targeting) {
        lastAxisAngle = Math.atan2(-e.deltaX, -e.deltaY)
      } else {
        let now = Date.now()
        if (now - lastRotateTime > rotateDebounce && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          lastRotateTime = now //keep from rotating again until axis is reset
          this.onTeleport({
            rotation: Math.sign(e.deltaX) * rotateBy + this.getCameraFacade().rotateY
          })
        }
      }
    })
  }

  afterUpdate () {
    this.markerConfig.visible = this.targeting
    super.afterUpdate()
  }

  getBoundingSphere () {
    return infiniteSphere
  }

  // Raycast for dragging events will hit anywhere on ground plane if no other object
  // is hit first.
  raycast (raycaster) {
    const intersection = raycaster.ray.intersectPlane(raycastPlane, tempVec3)
    return intersection
      ? [{
        distance: raycaster.ray.origin.distanceTo(intersection),
        point: intersection.clone()
      }]
      : null
  }
}
