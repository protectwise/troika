import { Object3DFacade } from 'troika-3d'
import { Mesh, MeshStandardMaterial, CylinderBufferGeometry } from 'three'

let getGeometry = () => {
  const geometry = new CylinderBufferGeometry(0.001, 0.001, 1)
    .translate(0, 0.5, 0)
    .rotateX(Math.PI / -2)
  getGeometry = () => geometry
  return geometry
}

let getMaterial = () => {
  const material = new MeshStandardMaterial({
    transparent: true,
    opacity: 0.2,
    color: 0x006699,
    emissive: 0x006699
  })
  getMaterial = () => material
  return material
}



class LaserPointerModel extends Object3DFacade {
  constructor(parent) {
    const mesh = new Mesh(getGeometry(), getMaterial())
    super(parent, mesh)
  }
  set length(val) {
    this.scaleZ = val || 1e10
  }
}

export default LaserPointerModel
