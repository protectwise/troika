import { utils } from 'troika-core'
import { ExtrudeBufferGeometry, Mesh, MeshStandardMaterial, Shape } from 'three'
import { MeshFacade } from 'troika-3d'

const getCogGeometry = utils.memoize(() => {
  let outerRadius = 0.01
  let innerRadius = 0.006
  let midRadius = (innerRadius + outerRadius) * .75
  let teeth = 8
  let twoPi = Math.PI * 2
  let shape = new Shape().moveTo(midRadius, 0)
  for (let i = 0; i < teeth; i++) {
    let angle = i / teeth * twoPi
    shape.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius)
    angle = (i + 0.5) / teeth * twoPi
    shape.lineTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius)
    shape.lineTo(Math.cos(angle) * midRadius, Math.sin(angle) * midRadius)
    if (i === teeth - 1) {
      shape.lineTo(midRadius, 0) //close shape exactly
    } else {
      angle = (i + 1) / teeth * twoPi
      shape.lineTo(Math.cos(angle) * midRadius, Math.sin(angle) * midRadius)
    }
  }
  shape.moveTo(innerRadius, 0).absellipse(0, 0, innerRadius, innerRadius, 0, twoPi, true)
  return new ExtrudeBufferGeometry(shape, {
    curveSegments: teeth * 2,
    depth: 0.005,
    bevelEnabled: false
  })
})

export class Cog extends MeshFacade {
  get geometry() {
    return getCogGeometry()
  }
}
