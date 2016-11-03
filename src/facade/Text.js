import forOwn from 'lodash/forOwn'
import Object3D from './Object3D'
import {Mesh, PlaneGeometry, MeshBasicMaterial, Texture, DoubleSide, LinearFilter} from 'three'


const canvas = document.createElement('canvas')
const context = canvas.getContext('2d')
const geometry = new PlaneGeometry(1, 1)


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
    let mesh = new Mesh(geometry, material)
    super(parent, mesh)
    this._needsTextureUpdate = true
    this.height = 1
  }

  afterUpdate() {
    let material = this.threeObject.material
    if (this._needsTextureUpdate) {
      let textureHeight = this.textureHeight
      let padding = this.padding
      let fontHeight = textureHeight * .66 - (padding[0] + padding[2]) * textureHeight //TODO is there a more accurate way to allow for descenders than the magic number?
      let fontString = `${ this.fontStyle } ${ this.fontWeight } ${ this.fontStretch } ${ fontHeight }pt ${ this.fontFamily }`

      // Measure size of the text and update the canvas to that size
      context.font = fontString
      let textureWidth = context.measureText(this.text).width + (padding[1] + padding[3]) * textureHeight
      this.textureWidth = textureWidth
      canvas.width = textureWidth
      canvas.height = textureHeight

      // Render into the canvas
      context.font = fontString
      context.textBaseline = 'top'
      if (this.backgroundColor) {
        context.fillStyle = this.backgroundColor
        context.fillRect(0, 0, textureWidth, textureHeight)
      }
      context.fillStyle = this.color
      context.fillText(this.text, padding[3] * textureHeight, padding[0] * textureHeight)

      // Update texture image
      let texture = material.map
      let img = texture.image
      img.width = textureWidth
      img.height = textureHeight
      img.src = canvas.toDataURL()
      texture.needsUpdate = true

      this._needsTextureUpdate = false
    }

    if (this.opacity !== material.opacity) {
      material.opacity = this.opacity
      material.transparent = material.opacity < 1
    }

    this.scaleX = this.height * this.textureWidth / this.textureHeight
    this.scaleY = this.height

    super.afterUpdate()
  }

  destructor() {
    let mesh = this.threeObject
    mesh.material.map.dispose()
    mesh.material.dispose()
  }
}

// Setters for properties that trigger a texture rebuild
forOwn({
  'text': '',
  'color': '#ffffff',
  'backgroundColor': null,
  'fontStretch': '',
  'fontStyle': '',
  'fontFamily': 'sans-serif',
  'fontWeight': '',
  'padding': [0, 0, 0, 0],
  'textureHeight': 50
}, (defaultValue, prop) => {
  let privateProp = `➤${ prop }`
  Text.prototype[privateProp] = defaultValue

  Object.defineProperty(Text.prototype, prop, {
    set: prop === 'padding' ?
      // special setter for padding
      function(value) {
        let lastValue = this[privateProp] //stored value will always be an array
        let equal = true
        if (typeof value === 'number') {
          equal = value === lastValue[0] && value === lastValue[1] && value === lastValue[2] && value === lastValue[3]
        }
        else if (Array.isArray(value)) {
          // check equality without creating transient array
          equal = value[0] === lastValue[0] &&
            value[value.length > 1 ? 1 : 0] === lastValue[1] &&
            value[value.length > 2 ? 2 : 0] === lastValue[2] &&
            value[value.length > 3 ? 3 : value.length > 1 ? 1 : 0] === lastValue[3]
        }
        else {
          throw new Error('Text.padding must be a number or an array of numbers')
        }
        if (!equal) {
          // normalize to 4-item array
          if (typeof value === 'number') {
            value = [value, value, value, value]
          } else if (value.length < 4) {
            value = value.slice()
            if (value.length < 2) value[1] = value[0]
            if (value.length < 3) value[2] = value[0]
            if (value.length < 4) value[3] = value[1]
          }
          this[privateProp] = value
          this._needsTextureUpdate = true
        }
      } :
      // setter for all simple values
      function(value) {
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
