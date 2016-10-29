import {List, Object3D} from '../../src/index'
import {Mesh, MeshPhongMaterial, SphereBufferGeometry, TextureLoader} from 'three/src/Three'
import Country from './Country'
import geojson from './countries.geojson.js'



const countriesData = []
Object.keys(geojson).forEach(region => {
  geojson[region].forEach(country => {
    countriesData.push(country)
  })
})


const textureLoader = new TextureLoader()


class Earth extends Object3D {
  constructor(parent) {
    var mesh = new Mesh(
      new SphereBufferGeometry(.995, 64, 64),
      new MeshPhongMaterial()
    )
    super(parent, mesh)

    this.children = [{
      key: 'countries',
      class: List,
      data: countriesData,
      template: {
        key: d => d.id,
        class: Country,
        id: d => d.id,
        coords: d => d.geometry.coordinates,
        color: this._getCountryColor.bind(this),
        textureMap: this._getCountryTextureMap.bind(this),
        wireframe: () => this.wireframe,
        onMouseOver: () => this._onCountryMouseOver,
        onMouseOut: () => this._onCountryMouseOut
      }
    }]
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

  _onCountryMouseOver = (e) => {
    var fn = this.onCountryMouseOver
    if (fn) fn(e.target.id)
  }

  _onCountryMouseOut = (e) => {
    var fn = this.onCountryMouseOut
    if (fn) fn(e.target.id)
  }
}



export default Earth
