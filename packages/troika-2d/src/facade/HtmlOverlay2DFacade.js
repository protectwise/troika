import Object2DFacade from './Object2DFacade.js'


/**
 * Defines a snippet of HTML content that will be positioned to line up with the object's
 * x/y coordinates after all transformations. This is a convenient way to display tooltips,
 * labels, and pieces of UI that follow a given object around.
 */
class HtmlOverlay2DFacade extends Object2DFacade {
  constructor(parent) {
    super(parent)

    /**
     * Defines the HTML content to be rendered. The type/format of this value is dependent
     * on the wrapping implementation; for example the Canvas2D.js React-based wrapper will
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

export default HtmlOverlay2DFacade
