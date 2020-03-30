import { Group3DFacade } from 'troika-3d'
import { Strap } from './Strap.js'
import { Cog } from './Cog.js'
import { copyXRPoseToFacadeProps } from '../../XRUtils.js'
import { Vector3 } from 'three'

const tempVec3 = new Vector3()

const cogActiveAnim = {
  from: {rotateX: 0},
  to: {rotateX: Math.PI * 2},
  duration: 5000,
  iterations: Infinity
}


const gripOffsetDist = 0.08
const gripOffsetAngle = Math.PI / 4
const largeRadius = 0.035
const smallRadius = largeRadius * 0.75
const strapWidth = 0.025


export class Wristband extends Group3DFacade {
  /**
   * Sync to the current XRFrame's gripPose - all matrix syncing is localized here
   * to avoid a full afterUpdate pass on every frame.
   */
  syncPose(gripPose) {
    if (gripPose) {
      this.visible = true
      copyXRPoseToFacadeProps(gripPose, this)
      this.traverse(updateMatrices)
      if (this.onCogMove && this._cogFacade) {
        this.onCogMove(this._cogFacade.getWorldPosition(tempVec3))
      }
    } else {
      this.visible = false
    }
  }

  describeChildren () {
    let { active } = this

    let groupDef = this._childTpl || (this._childTpl = {
      key: 'g',
      facade: Group3DFacade,
      rotateX: -gripOffsetAngle,
      y: gripOffsetDist * Math.cos(gripOffsetAngle),
      z: gripOffsetDist * Math.sin(gripOffsetAngle),
      children: [
        {
          key: 'strap',
          facade: Strap,
          smallRadius,
          largeRadius,
          width: strapWidth
        },
        {
          key: 'cog',
          facade: Cog,
          ref: f => {
            this._cogFacade = f
          },
          rotateY: Math.PI / 2,
          x: smallRadius,
          animation: null,
          transition: {
            scale: {
              duration: 500,
              easing: 'easeOutBack'
            },
            'material.color': {
              interpolate: 'color'
            }
          }
        }
      ]
    })

    let [, cogDef] = groupDef.children
    cogDef.scale = active ? 1.75 : 1
    cogDef['material.color'] = active ? 0x3399ff : 0x999999
    cogDef.animation = active ? cogActiveAnim : null

    return groupDef
  }
}


function updateMatrices(obj) {
  if (obj.updateMatrices) {
    obj.updateMatrices()
  }
}
