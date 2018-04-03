import {UIBlock3DFacade} from '../../src/index'

/**
 * Convenience class for displaying icons using the Material Icons library. See https://material.io/icons/
 *
 * Use this just like any other UIBlock3DFacade, but set its `icon` property to the name of the icon
 * you wish to display.
 *
 * Note: internally this simply sets the 'text' property, using the Material Icons web font. Since that
 * font utilizes ligatures to alias each icon's full name to its glyph, and Troika's text rendering engine
 * has support for ligatures, this just works without having to deal with obscure character codes.
 */
export default class MaterialIconFacade extends UIBlock3DFacade {
  constructor(parent) {
    super(parent)

    // Material Icons font URL
    this.font = 'https://fonts.gstatic.com/s/materialicons/v36/flUhRq6tzZclQEJ-Vdg-IuiaDsNa.woff'
  }

  set icon(val) {
    this.text = val
  }
  set size(val) {
    this.fontSize = val
  }
}