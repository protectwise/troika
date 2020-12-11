import { Object3DFacade, CircleFacade } from 'troika-3d'
import { Group, Matrix4, Vector3 } from 'three'
import { Projection } from './Projection.js'

const tempMat4 = new Matrix4()
const targetPos = new Vector3()
const camPos = new Vector3()

export class ContentContainer extends Object3DFacade {
  constructor (parent) {
    super(parent, new Group())
    this.distancePastGrip = 0.25 //distance past grip in camera-to-grip direction
    this.minDistanceFromCamera = 0.5
    this.heightAboveGrip = 0.15
    this.platformRadius = 0.25
    this.projectionColor = null
    this.projectionSourcePosition = null //worldspace vec3
    this.gripPose = null
    this.active = false
    this.keepContentAlive = false
  }

  /**
   * Sync to the current XRFrame's gripPose - all matrix syncing is localized here
   * to avoid a full afterUpdate pass on every frame.
   */
  syncPose(gripPose) {
    let visible = false
    if (gripPose) {
      // Get current posed camera position, relative to the parent
      let cam = this.getCameraFacade().threeObject
      camPos.setFromMatrixPosition(cam.matrixWorld)
        .applyMatrix4(tempMat4.getInverse(this.threeObject.parent.matrixWorld))

      // Find target position
      let targetScale
      if (this.active) {
        // Find direction vector and lengthen it to the target distance to find base position
        targetPos.copy(gripPose.transform.position)
        targetPos.y = camPos.y
        targetPos.sub(camPos)
        targetPos.setLength(Math.max(this.minDistanceFromCamera, targetPos.length() + this.distancePastGrip))
        targetPos.add(camPos)
        targetPos.y = gripPose.transform.position.y + this.heightAboveGrip
        targetScale = 1
      } else {
        targetPos.copy(gripPose.transform.position)
        targetScale = 0.001
      }

      // Pull partway toward target position and scale, like a spring
      let pos = this.threeObject.position
      pos.lerp(targetPos, 0.05) //move by 5% of distance each frame)
      this.scale += (targetScale - this.scale) * 0.3
      visible = this.scale > 0.01 //hide below a certain size

      if (visible) {
        // Rotate to face camera
        this.rotateY = Math.atan2(camPos.x - pos.x, camPos.z - pos.z)

        // Update projection cone's source position
        let proj = this.getChildByKey('$projection')
        if (proj) {
          proj.syncSourcePosition()
        }

        // Sync all matrices
        this.traverse(updateMatrices)
      }
    }
    if (visible !== this.visible) {
      this.update({visible})
    }
  }

  describeChildren() {
    if (!this.visible && !this.keepContentAlive) {
      return null
    }

    let kids = this._kidsTpl || (this._kidsTpl = [
      {
        key: '$platform',
        facade: CircleFacade,
        radius: 1,
        material: 'lambert',
        castShadow: true,
        receiveShadow: true,
        'material.color': 0x333333
      },
      {
        key: '$projection',
        facade: Projection,
        sourceWorldPosition: new Vector3(),
        targetVertices: Object.freeze(function () {
          // trace circular path
          let verts = []
          for (let i = 0; i < 32; i++) {
            let angle = Math.PI * 2 * (i / 32)
            verts.push(Math.cos(angle), 0, Math.sin(angle))
          }
          return verts
        }())
      }
    ])

    // Update platform size
    kids[0].scale = kids[1].scale = this.platformRadius

    // Update projection source
    kids[1].sourceWorldPosition = this.projectionSourcePosition

    // Colors
    kids[0]['material.color'] = this.platformColor
    kids[1].color = this.projectionColor

    return kids.concat(this.children)
  }
}

function updateMatrices(obj) {
  if (obj.updateMatrices) {
    obj.updateMatrices()
    obj._checkBoundsChange() //TODO ugh shouldn't have to call private method
  }
}

