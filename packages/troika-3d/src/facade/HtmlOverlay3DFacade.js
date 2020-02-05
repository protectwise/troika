import {Object3D} from 'three'
import Object3DFacade from './Object3DFacade.js'


/**
 * Defines a snippet of HTML content that will be positioned to line up with the object's
 * xyz as projected by the scene's camera. This is a convenient way to display tooltips,
 * labels, and pieces of UI that follow a given object around.
 */
class HtmlOverlay3DFacade extends Object3DFacade {
  constructor(parent) {
    let obj = new Object3D()
    obj.isRenderable = false //trigger optimizations
    super(parent, obj)

    /**
     * Defines the HTML content to be rendered. The type/format of this value is dependent
     * on the wrapping implementation; for example the Canvas3D.js React-based wrapper will
     * expect a React element descriptor, while other wrappers might expect a HTML string.
     *
     * When using the React-based wrapper, the rendered React component will not be updated
     * when the overlay is repositioned, unless (a) the `html` element descriptor changes, or
     * (b) that element descriptor has a `shouldUpdateOnMove` prop.
     */
    this.html = null

    /**
     * If set to true, the overlay's x/y position on screen will not be rounded to whole-pixel
     * values. This can give more accurate alignment at the expense of fuzzy lines and text.
     */
    this.exact = false

    this.notifyWorld('addHtmlOverlay', this)
  }

  destructor() {
    this.notifyWorld('removeHtmlOverlay', this)
    super.destructor()
  }
}

export default HtmlOverlay3DFacade
