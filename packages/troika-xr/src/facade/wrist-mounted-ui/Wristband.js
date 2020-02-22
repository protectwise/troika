import { Group3DFacade } from 'troika-3d'
import { Strap } from './Strap.js'
import { Cog } from './Cog.js'


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
  set gripPose(gripPose) {
    if (gripPose) {
      this.visible = true
      this.threeObject.matrixWorld.fromArray(gripPose.transform.matrix)
      this.markWorldMatrixDirty()
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
          facade: Strap,
          smallRadius,
          largeRadius,
          width: strapWidth
        },
        {
          facade: Cog,
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
