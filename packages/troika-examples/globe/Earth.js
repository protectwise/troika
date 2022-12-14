import {ListFacade} from 'troika-core'
import {Object3DFacade} from 'troika-3d'
import {Mesh, MeshPhongMaterial, SphereGeometry, TextureLoader} from 'three'
import Country from './Country'
import geojson from './countries.geojson.json'

const textureLoader = new TextureLoader()




const countriesData = []
Object.keys(geojson).forEach(region => {
  geojson[region].forEach(country => {
    countriesData.push(country)
  })
})



class Earth extends Object3DFacade {
  constructor(parent) {
    let mesh = new Mesh(
      new SphereGeometry(.995, 64, 64),
      new MeshPhongMaterial()
    )
    super(parent, mesh)

    this._onCountryMouseOver = (e) => {
      let fn = this.onCountryMouseOver
      if (fn) fn(e.target.id)
    }

    this._onCountryMouseOut = (e) => {
      let fn = this.onCountryMouseOut
      if (fn) fn(e.target.id)
    }

    this.children = {
      key: 'countries',
      facade: ListFacade,
      data: countriesData,
      template: {
        key: d => d.id,
        facade: Country,
        id: d => d.id,
        coords: d => d.geometry.coordinates,
        color: this._getCountryColor.bind(this),
        textureMap: this._getCountryTextureMap.bind(this),
        wireframe: () => this.wireframe,
        onMouseOver: () => this._onCountryMouseOver,
        onMouseOut: () => this._onCountryMouseOut,
        transition: {
          color: {interpolate: 'color'}
        }
      }
    }
  }

  set oceanColor(c) {
    this.threeObject.material.color.set(c)
  }

  set oceanTexture(t) {
    if (t !== this._oceanTextureUrl) {
      let material = this.threeObject.material
      material.map = t ? textureLoader.load(t) : null
      material.needsUpdate = true
      this._oceanTextureUrl = t
    }
  }

  set countryTexture(t) {
    if (t !== this._countryTextureUrl) {
      this._countryTexture = t ? textureLoader.load(t) : null
      this._countryTextureUrl = t
    }
  }

  _getCountryTextureMap() {
    return this._countryTexture
  }

  _getCountryColor(d, i, arr) {
    var fn = this.getCountryColor
    return fn ? fn(d, i, arr) : 0x000000
  }
}



export default Earth
