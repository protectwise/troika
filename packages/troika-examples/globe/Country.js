import {Mesh, MeshPhongMaterial} from 'three'
import {Object3DFacade} from 'troika-3d'
import CountryBufferGeometry from './CountryBufferGeometry'



const baseCountryMaterial = new MeshPhongMaterial()


export default class Country extends Object3DFacade {
  constructor(parent) {
    let mesh = new Mesh(
      new CountryBufferGeometry(),
      baseCountryMaterial.clone()
    )
    super(parent, mesh)
  }

  set coords(coords) {
    // Only allow setting coords once
    if (!this._coords) {
      this.threeObject.geometry.setCoordinates(coords)
      this._coords = coords
    }
  }

  set color(c) {
    this.threeObject.material.color.set(c)
  }
  get color() {
    return this.threeObject.material.color
  }

  set textureMap(map) {
    if (map !== this.textureMap) {
      let material = this.threeObject.material
      material.map = map
      material.needsUpdate = true
    }
  }
  get textureMap() {
    return this.threeObject.material.map
  }

  set wireframe(w) {
    if (w !== this.wireframe) {
      this.threeObject.material.wireframe = !!w
      this.threeObject.material.needsUpdate = true
    }
  }
  get wireframe() {
    return this.threeObject.material.wireframe
  }
}
