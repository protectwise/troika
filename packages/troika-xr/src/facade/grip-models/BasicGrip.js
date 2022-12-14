import { Object3DFacade } from 'troika-3d'
import { Mesh, MeshStandardMaterial, CylinderGeometry } from 'three'

let getGeometry = () => {
  const geometry = new CylinderGeometry(0.03, 0.05, 0.1, 8)
    .rotateX(Math.PI / -2)
    .translate(0, 0, 0.05)
  getGeometry = () => geometry
  return geometry
}

let getMaterial = () => {
  const material = new MeshStandardMaterial({
    color: 0x666666,
    emissive: 0x666666,
    roughness: 0.5,
    metalness: 0.5
  })
  getMaterial = () => material
  return material
}


/**
 * Very basic tracked controller model
 */
class Basic extends Object3DFacade {
  constructor(parent) {
    const mesh = new Mesh(getGeometry(), getMaterial())
    super(parent, mesh)
  }
}

export default Basic
