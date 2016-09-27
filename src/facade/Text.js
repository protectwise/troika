import _ from 'lodash'
import Object3D from './Object3D'
import {Mesh, PlaneGeometry, MeshBasicMaterial, Texture, DoubleSide, LinearFilter} from 'three'


const canvas = document.createElement('canvas')
const context = canvas.getContext('2d')



class Text extends Object3D {
  constructor(parent) {
    let img = new Image()
    let texture = new Texture(img)
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    let material = new MeshBasicMaterial({
      map: texture,
      side: DoubleSide,
      transparent: true
    })
    let mesh = new Mesh(new PlaneGeometry(1, 1), material)
    super(parent, mesh)
    this._needsTextureUpdate = true
    this.height = 1
  }

  afterUpdate() {
    if (this._needsTextureUpdate) {
      let textureHeight = this.textureHeight
      let fontHeight = textureHeight * .66 //TODO is there a more accurate way to allow for descenders than this magic number?
      let fontString = `${ this.fontStyle } ${ this.fontWeight } ${ this.fontStretch } ${ fontHeight }pt ${ this.fontFamily }`

      // Measure size of the text and update the canvas to that size
      context.font = fontString
      let textureWidth = context.measureText(this.text).width
      this.textureWidth = textureWidth
      canvas.width = textureWidth
      canvas.height = textureHeight

      // Render into the canvas
      context.font = fontString
      context.textBaseline = 'top'
      context.fillStyle = this.color
      context.fillText(this.text, 0, 0);

      // Update texture image
      let texture = this.threeObject.material.map
      let img = texture.image
      img.width = textureWidth
      img.height = textureHeight
      img.src = canvas.toDataURL()
      texture.needsUpdate = true

      this._needsTextureUpdate = false
    }

    this.scaleX = this.height * this.textureWidth / this.textureHeight
    this.scaleY = this.height

    super.afterUpdate()
  }

  destructor() {
    let mesh = this.threeObject
    mesh.material.map.dispose()
    mesh.material.dispose()
    mesh.geometry.dispose()
  }
}

// Setters for properties that trigger a texture rebuild
_.each({
  'text': '',
  'color': '#ffffff',
  'fontStretch': '',
  'fontStyle': '',
  'fontFamily': 'sans-serif',
  'fontWeight': '',
  'textureHeight': 50
}, (defaultValue, prop) => {
  let privateProp = `➤${ prop }`
  Text.prototype[privateProp] = defaultValue

  Object.defineProperty(Text.prototype, prop, {
    set(value) {
      if (value !== this[privateProp]) {
        this[privateProp] = value
        this._needsTextureUpdate = true
      }
    },

    get() {
      return this[privateProp]
    }
  })
})




export default Text
