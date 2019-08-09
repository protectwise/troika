import { Object3DFacade } from 'troika-3d'
import { Mesh, MeshStandardMaterial, ConeBufferGeometry } from 'three'

let getGeometry = () => {
  const geometry = new ConeBufferGeometry(0.05, 0.2, 16).rotateX(Math.PI / -2)
  getGeometry = () => geometry
  return geometry
}

let getMaterial = () => {
  const material = new MeshStandardMaterial({
    transparent: true,
    opacity: 0.8,
    color: 0x006699,
    emissive: 0x006699
  })
  getMaterial = () => material
  return material
}


/**
 * Very basic tracked controller model
 */
class BasicModelFacade extends Object3DFacade {
  constructor(parent) {
    const mesh = new Mesh(getGeometry(), getMaterial())
    super(parent, mesh)
  }
}

export default BasicModelFacade