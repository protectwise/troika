import { textRectToCssMatrix } from './selectionUtils'


const domOverlayBaseStyles = `
position:fixed;
top:0;
left:0;
opacity:0;
overflow:hidden;
margin:0;
pointer-events:none;
width:10px;
height:10px;
transform-origin:0 0;
font-size:10px;
line-height: 10px;
user-select: all;
`

const domSRoutline = `
line-break: anywhere;
line-height: 0px;
display: flex;
align-items: center;
`

const makeDOMAcessible = (textInstance, options = {}) => {

  const _options = Object.assign({
    domContainer: document.documentElement,
    tagName: 'p',
    observeMutation: true
  }, options);

  textInstance._domElText = document.createElement(_options.tagName)

  _options.domContainer.appendChild(textInstance._domElText)
  textInstance._domElText.style = domOverlayBaseStyles + domSRoutline
  textInstance.isDOMAccessible = true

  /**
   * When a change occurs on the overlaying HTML, it reflect it in the renderer context
   */
  textInstance.mutationCallback = function (mutationsList, observer) {
    this.currentHTML = this._domElText.innerHTML
    this.currentText = this.currentHTML.replace(/<(?!br\s*\/?)[^>]+>/g, '').replace(/<br\s*[\/]?>/gi, "\n");
    this._needsSync = true;
    this.sync()
  }

  if (_options.observeMutation) {
    /**
     * Start watching change on the overlaying HTML such as browser dom translation in order to reflect it in the renderer context
     */
    textInstance.startObservingMutation = function () {
      textInstance.observer = new MutationObserver(textInstance.mutationCallback.bind(textInstance));
      textInstance.observer.observe(textInstance._domElText, { attributes: false, childList: true, subtree: false });
    }
    textInstance.startObservingMutation()
  }

  textInstance.prevText = ''
  textInstance.currentText = ''
  textInstance.prevHTML = ''
  textInstance.currentHTML = ''
  textInstance.prevCurveRadius = 0
  textInstance.pauseDomSync = false

  textInstance.syncDOM = function () {
    this.currentText = this.text
    this.prevText = this.text
    this.currentHTML = this.text.replace(/(?:\r\n|\r|\n)/g, '<br>')
    this.observer.disconnect()
    this._domElText.innerHTML = this.currentHTML;
    this.prevHTML = this.currentHTML
    this.observer.observe(this._domElText, { attributes: false, childList: true, subtree: false });
  }

  textInstance.addEventListener('textChange', textInstance.syncDOM)

  textInstance.syncDOM()

  /**
   * update the position of the overlaying HTML that contain all the text that need to be accessible to screen readers
   */
  textInstance.updateDomPosition = function (renderer, camera) {
    if (!this.pauseDomSync) {
      const { min, max } = this.geometry.boundingBox
      this._domElText.style.transform = textRectToCssMatrix(min.x, min.y, max.x, max.y, max.z, renderer, camera, this.matrixWorld)
    }
  }

  textInstance.addEventListener('afterrender', function () {
    const renderer = this.renderer
    const camera = this.camera
    this.updateDomPosition(renderer, camera)
  })

  textInstance.pause = function () {
    this.pauseDomSync = true
  }

  textInstance.resume = function () {
    this.pauseDomSync = false
  }

  textInstance.destroy = function () {
    this.observer.disconnect()
    this._domElText.remove()
  }

}

export {
  makeDOMAcessible
}
