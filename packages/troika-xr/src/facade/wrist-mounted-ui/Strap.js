import { utils } from 'troika-core'
import { CylinderBufferGeometry, DoubleSide, Mesh, MeshStandardMaterial } from 'three'
import { Object3DFacade } from 'troika-3d'


const getStrapGeometry = utils.memoize(() => {
  return new CylinderBufferGeometry(
    1,
    1,
    1,
    64,
    1,
    true,
    // Math.PI / 4 * 3,
    // Math.PI / 4 * 6
  )
    .rotateX(Math.PI / 2)
})

const getStrapMaterial = utils.memoize(() => {
  return new MeshStandardMaterial({
    color: 0x333333,
    side: DoubleSide
  })
})

export class Strap extends Object3DFacade {
  constructor (parent) {
    super(parent, new Mesh(getStrapGeometry(), getStrapMaterial()))
  }
  set smallRadius(val) {
    this.scaleX = val
  }
  set largeRadius(val) {
    this.scaleY = val
  }
  set width(val) {
    this.scaleZ = val
  }
}
