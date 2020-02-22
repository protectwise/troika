import { Object3DFacade, PlaneFacade } from 'troika-3d'
import { Group, Matrix4, Vector3 } from 'three'
import { Projection } from './Projection.js'

const tempMat4 = new Matrix4()
const targetPos = new Vector3()
const camPos = new Vector3()
const curPos = new Vector3()

export class ContentContainer extends Object3DFacade {
  constructor (parent) {
    super(parent, new Group())
    this.distancePastGrip = 0.25 //distance past grip in camera-to-grip direction
    this.minDistanceFromCamera = 0.5
    this.heightAboveGrip = 0.15
    this.gripPose = null
    this.active = false
  }

  afterUpdate() {
    const {gripPose} = this
    if (gripPose) {
      this.getCameraPosition(camPos)

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
      this.getWorldPosition(curPos)
      curPos.lerp(targetPos, 0.05) //move by 5% of distance each frame)
      curPos.copy.call(this, curPos) //sets x,y,z
      this.scale += (targetScale - this.scale) * 0.3
      this.visible = this.scale > 0.01 //hide below a certain size

      // Rotate to face camera
      this.rotateY = Math.atan2(camPos.x - curPos.x, camPos.z - curPos.z)
    } else {
      this.visible = false
    }

    super.afterUpdate()
  }

  // shouldUpdateChildren () {
  //   return !!this.active
  // }

  describeChildren() {
    let radiusX = 0.5 / 2
    let radiusZ = 0.3 / 2
    let kids = this._kidsTpl || (this._kidsTpl = [
      {
        key: '$platform',
        facade: PlaneFacade,
        width: radiusX * 2,
        depth: radiusZ * 2,
        'material.color': 0x666666,
        'material.metalness': 0.8,
        'material.roughness': 0.3
      },
      {
        key: '$projection',
        facade: Projection,
        from: new Vector3(),
        to1: new Vector3(),
        to2: new Vector3(),
        to3: new Vector3(),
        to4: new Vector3()
      }
    ])
    if (this.gripPose && this.visible) {
      kids[1].from.set(0.027, 0.056, 0.056).applyMatrix4(tempMat4.fromArray(this.gripPose.transform.matrix))

      let mtx = this.threeObject.matrixWorld
      kids[1].to1.set(-radiusX, 0, -radiusZ).applyMatrix4(mtx)
      kids[1].to2.set(radiusX, 0, -radiusZ).applyMatrix4(mtx)
      kids[1].to3.set(radiusX, 0, radiusZ).applyMatrix4(mtx)
      kids[1].to4.set(-radiusX, 0, radiusZ).applyMatrix4(mtx)
    }
    return kids.concat(this.children)
  }
}

