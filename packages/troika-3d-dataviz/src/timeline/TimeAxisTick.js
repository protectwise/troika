import { Instanceable3DFacade, Group3DFacade, Object3DFacade } from 'troika-3d'
import { BufferAttribute, BufferGeometry, DoubleSide, LineSegments, MeshBasicMaterial, Vector3 } from 'three'
import { AutoScalingText } from '../AutoScalingText.js'
import memoizeOne from 'memoize-one'

const tickObj = new LineSegments(
  new BufferGeometry(),
  new MeshBasicMaterial({ color: 0x999999, transparent: true })
)
tickObj.renderOrder = 1
tickObj.geometry.setAttribute('position', new BufferAttribute(new Float32Array(
  [0, 0, 0, 0, 0, -1]
), 3))

export class TickLine extends Instanceable3DFacade {
  instancedThreeObject = tickObj
  opacity = 0
  fade = 0

  afterUpdate() {
    this.setInstanceUniform('opacity', this.opacity * this.fade)
    super.afterUpdate()
  }
}

// class TickLine extends Object3DFacade {
//   initThreeObject() {
//     return tickObj.clone()
//   }
// }

const textMaterial = new MeshBasicMaterial()

export class TimeAxisTick extends Group3DFacade {
  fade = 1

  children = [
    {
      key: 'tick',
      facade: TickLine
    },
    {
      key: 'labels',
      facade: Group3DFacade,
      transition: {
        rotateY: {duration: 500, easing: 'easeOutExpo'},
        rotateZ: {duration: 500, easing: 'easeOutExpo'}
      },
      onBeforeRender: angleLabelTowardCamera,
      children: [
        {
          key: 'text',
          facade: AutoScalingText,
          size: 15,
          anchorX: 'left',
          anchorY: 'top',
          material: textMaterial.clone(),
          onBeforeRender: flipTextToFaceUser
        }
      ]
    }
  ]

  _getLabel = memoizeOne((t, isFirst) => {
    const d = new Date(t)
    const hasTime = d.getHours() || d.getMinutes() || d.getSeconds() || d.getMilliseconds()
    let lines = []
    if (!hasTime || isFirst) lines.push(d.toLocaleString(undefined, { dateStyle: 'medium' }))
    if (hasTime) lines.push(d.toLocaleString(undefined, { timeStyle: 'medium' }))
    return lines.join('\n')
  })

  afterUpdate () {
    const [tickDef, labelsDef] = this.children
    const { timestamp, timeScale, index, depth, opacity, fade } = this
    this.x = timeScale(timestamp)
    tickDef.scaleZ = depth
    tickDef.opacity = opacity
    tickDef.fade = fade
    for (let lbl of labelsDef.children) {
      lbl.text = this._getLabel(timestamp, index === 0)
      lbl.material.opacity = opacity * fade
    }
    super.afterUpdate()
  }
}

const tempVec3a = new Vector3()
const tempVec3b = new Vector3()
const tempVec3c = new Vector3()

function flipTextToFaceUser() {
  // ('this' is the text facade)
  const worldPos = this.getWorldPosition(tempVec3a)
  const camDir = this.getCameraPosition(tempVec3b).sub(worldPos)
  const normalDir = tempVec3c.set(1, 0, 0).applyMatrix4(this.parent.threeObject.matrixWorld).sub(worldPos)
  const flipText = camDir.dot(normalDir) > 0
  this.rotateY = Math.PI / 2 * (flipText ? 1 : -1)
  if (flipText) {
    // Since this is AutoScalingText, we need to adjust the position offset by the current scale
    const scale = tempVec3c.setFromMatrixColumn(this.threeObject.matrixWorld, 0).length()
    this.z = (this.textRenderInfo?.blockBounds[2] || 0) * scale
  } else {
    this.z = 0
  }
}

function angleLabelTowardCamera() {
  // ('this' is the label group)
  const worldPos = this.getWorldPosition(tempVec3a)
  const camDir = this.getCameraPosition(tempVec3b).sub(worldPos)
  const normalDir = tempVec3c.set(0, 0, 1).applyMatrix4(this.parent.threeObject.matrixWorld).sub(worldPos)
  const toRight = normalDir.cross(camDir).y < 0
  this.rotateY = Math.PI / 6 * (toRight ? 1 : -1)
  this.rotateZ = Math.PI / 3 * (toRight > 0 ? -1 : 1)
}
