import {Object3DFacade} from 'troika-3d'
import { Mesh, MeshStandardMaterial, PlaneBufferGeometry } from 'three'

export default class ShadowSurface extends Object3DFacade {
  constructor(parent) {
    super(parent, new Mesh(
      new PlaneBufferGeometry(),
      new MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.8,
        metalness: 0.5
      })
    ))
  }
}
