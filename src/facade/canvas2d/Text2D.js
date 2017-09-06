import {assign} from '../../utils'
import Object2DFacade from './Object2D'

class Text2DFacade extends Object2DFacade {
  render(context) {
    context.font = `${ this.fontStyle } ${ this.fontWeight } ${ this.fontStretch } ${ this.fontSize } ${ this.fontFamily }`
    context.textAlign = this.textAlign
    context.textBaseline = this.textBaseline
    context.fillStyle = this.color
    context.globalAlpha = this.opacity
    context.fillText(this.text, 0, 0)
  }
}

// Defaults
assign(Text2DFacade.prototype, {
  color: '#fff',
  fontFamily: 'sans-serif',
  fontSize: '12px',
  fontStretch: '',
  fontStyle: '',
  fontWeight: '',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  text: '',
  opacity: 1
})

export default Text2DFacade
