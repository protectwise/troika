import {
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Vector4,
  Vector3,
  Vector2,
  BoxBufferGeometry
} from 'three'
import { createDerivedMaterial } from 'troika-three-utils'
import { getSelectionRects, getCaretAtPoint } from './selectionUtils'

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

const A11yManager = /*#__PURE__*/(() => {

  const defaultSelectionColor = 0xffffff

  const tempMat4a = new Matrix4()
  const tempMat4b = new Matrix4()
  const tempVec3 = new Vector3()

  /**
   * @class Text
   *
   * A ThreeJS Mesh that renders a string of text on a plane in 3D space using signed distance
   * fields (SDF).
   */
  class A11yManager {
    constructor(textMesh) {

      this.textMesh = textMesh

      this._domElSelectedText = document.createElement('p')
      this._domElText = document.createElement(this.tagName ? this.tagName : 'p')
      this.selectionStartIndex = 0;
      this.selectionEndIndex = 0;
      this.selectedText = null;

      //todo how to pass a dom container
      this.domContainer = this.textMesh.domContainer ? this.textMesh.domContainer : document.documentElement
      this.domContainer.appendChild(this._domElSelectedText)
      this.domContainer.appendChild(this._domElText)

      this._domElSelectedText.setAttribute('aria-hidden','true')
      this._domElSelectedText.style = domOverlayBaseStyles
      this._domElText.style = domOverlayBaseStyles + domSRoutline

      this.startObservingMutation()

      this.selectionRects = []
      this.selectionRectsMeshs = []

      this.prevText = ''
      this.currentText = ''
      this.prevHTML = ''
      this.currentHTML = ''
      this.prevCurveRadius = 0

      /* create it only once */
      this.childrenGeometry = new BoxBufferGeometry(1, 1, 0.1).translate(0.5, 0.5, 0.5)
      /* create it only once */
      this.childrenCurvedGeometry = new BoxBufferGeometry(1, 1, 0.1,32).translate(0.5, 0.5, 0.5)
    }

   
    sync() {
      if(this.prevText !== this.textMesh.text){
        this.textMesh.currentText = this.textMesh.text
        this.prevHTML = this.currentHTML
        this.currentHTML = this.textMesh.text.replace(/(?:\r\n|\r|\n)/g, '<br>')
        this.prevText = this.textMesh.text
      }
      
      this.textMesh.currentText = this.textMesh.currentText ? this.textMesh.currentText : this.textMesh.text

      //update dom with latest text
      if(this.prevHTML !== this.currentHTML){
        this.observer.disconnect()
        this._domElText.innerHTML = this.currentHTML;
        this.prevHTML = this.currentHTML
        this.observer.observe(this._domElText, { attributes: false, childList: true, subtree: false });
      }

      if(!this.textMesh.selectable && this.selectionRects.length != 0)
      this.clearSelection()
    }

    /**
     * Given a local x/y coordinate in the text block plane, set the start position of the caret 
     * used in text selection 
     * @param {number} x
     * @param {number} y
     * @return {TextCaret | null}
     */
    startCaret(textRenderInfo,x,y){
      let caret = getCaretAtPoint(textRenderInfo, x, y)
      this.selectionStartIndex = caret.charIndex
      this.selectionEndIndex = caret.charIndex
      this.updateSelection(textRenderInfo)
      return caret
    }

    clearSelection(){
      this.selectionStartIndex = 0
      this.selectionEndIndex = 0
      this.selectionRects = []
      this._domElSelectedText.textContent = ''
      this.highlightText()
    }

    /**
     * Given a local x/y coordinate in the text block plane, set the end position of the caret 
     * used in text selection 
     * @param {number} x
     * @param {number} y
     * @return {TextCaret | null}
     */
    moveCaret(textRenderInfo,x,y){
      let caret = getCaretAtPoint(textRenderInfo, x, y)
      this.selectionEndIndex = caret.charIndex
      this.updateSelection(textRenderInfo)
      return caret
    }

    /**
     * update the selection visually and everything related to copy /paste
     */
    updateSelection(textRenderInfo) {
      this.selectedText = this.textMesh.text.substring(this.selectionStartIndex,this.selectionEndIndex)
      this.selectionRects = getSelectionRects(textRenderInfo,this.selectionStartIndex,this.selectionEndIndex)
      this._domElSelectedText.textContent = this.selectedText
      this.highlightText()
      this.selectDomText()
    }

    /**
     * Select the text contened in _domElSelectedText in order for it to reflect what's currently selected in the Text
     */
    selectDomText(){
        const sel = document.getSelection()
        sel.removeAllRanges()
        const range = document.createRange()
        range.selectNodeContents(this._domElSelectedText); //sets Range
        sel.removeAllRanges(); //remove all ranges from selection
        sel.addRange(range);
    }

    /**
     * update the position of the overlaying HTML that contain all the text that need to be accessible to screen readers
     */
    updateDomPosition(renderer, camera) {
      const {min, max} = this.textMesh.geometry.boundingBox
      this._domElText.style.transform = this._textRectToCssMatrix(min.x, min.y, max.x, max.y, max.z, renderer, camera)
    }

    /**
     * update the position of the overlaying HTML that contain
     * the selected text in order for it to be acessible through context menu copy
     */
    updateSelectedDomPosition(renderer, camera) {
      const rects = this.selectionRects
      const el = this._domElSelectedText
      if (rects && rects.length) {
        // Find local space rect containing all selection rects
        // TODO can we wrap this even tighter to multiline selections where top/bottom lines are partially selected?
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (let i = 0; i < rects.length; i++) {
          minX = Math.min(minX, rects[i].left)
          minY = Math.min(minY, rects[i].bottom)
          maxX = Math.max(maxX, rects[i].right)
          maxY = Math.max(maxY, rects[i].top)
        }

        const z = this.textMesh.geometry.boundingBox.max.z
        el.style.transform = this._textRectToCssMatrix(minX, minY, maxX, maxY, z, renderer, camera)
        el.style.display = 'block'
      } else {
        el.style.display = 'none'
      }
    }

    /**
     * Given a rect in local text coordinates, build a CSS matrix3d that will transform
     * a 10x10 DOM element to line up exactly with that rect on the screen.
     * @private
     */
    _textRectToCssMatrix(minX, minY, maxX, maxY, z, renderer, camera) {
      const canvasRect = renderer.domElement.getBoundingClientRect()

      // element dimensions to geometry dimensions (flipping the y)
      tempMat4a.makeScale((maxX - minX) / 10, (minY - maxY) / 10, 1)
        .setPosition(tempVec3.set(minX, maxY, z))

      // geometry to world
      tempMat4a.premultiply(this.textMesh.matrixWorld)

      // world to camera
      tempMat4a.premultiply(camera.matrixWorldInverse)

      // camera to projection
      tempMat4a.premultiply(camera.projectionMatrix)

      // projection coords (-1 to 1) to screen pixels
      tempMat4a.premultiply(
        tempMat4b.makeScale(canvasRect.width / 2, -canvasRect.height / 2, 1)
          .setPosition(canvasRect.left + canvasRect.width / 2, canvasRect.top + canvasRect.height / 2, 0)
      )

      return `matrix3d(${tempMat4a.elements.join(',')})`
    }

    /**
     * visually update the rendering of the text selection in the renderer context
     */
    highlightText() {

      let THICKNESS = 0.25;
      //todo manage rect update in a cleaner way. Currently we recreate everything everytime
      //clean dispose of material no need to do it for geometry because we reuse the same
      this.selectionRectsMeshs.forEach((rect)=>{
        if(rect.parent)
        rect.parent.remove(rect)
        rect.material.dispose()
      })
      this.selectionRectsMeshs=[]

      this.selectionRects.forEach((rect)=>{
        let material = createDerivedMaterial(
          this.textMesh.selectionMaterial ? this.textMesh.selectionMaterial : new MeshBasicMaterial({
            color:this.textMesh.selectionColor ? this.textMesh.selectionColor : defaultSelectionColor,
            transparent: true,
            opacity: 0.3,
            depthWrite: false
          }),
          {
            uniforms: {
              rect: {value: new Vector4(
                rect.left ,
                rect.top ,
                rect.right ,
                rect.bottom 
              )},
              depthAndCurveRadius: {value: new Vector2(
                (rect.top - rect.bottom)*THICKNESS,
                this.textMesh.curveRadius
              )}
            },
              vertexDefs: `
              uniform vec4 rect;
              uniform vec2 depthAndCurveRadius;
              `,
              vertexTransform: `
              float depth = depthAndCurveRadius.x;
              float rad = depthAndCurveRadius.y;
              position.x = mix(rect.x, rect.z, position.x);
              position.y = mix(rect.w, rect.y, position.y);
              position.z = mix(-depth * 0.5, depth * 0.5, position.z);
              if (rad != 0.0) {
                float angle = position.x / rad;
                position.xz = vec2(sin(angle) * (rad - position.z), rad - cos(angle) * (rad - position.z));
                // TODO fix normals: normal.xz = vec2(sin(angle), cos(angle));
              }
              `
            }
          )
          material.instanceUniforms = ['rect', 'depthAndCurveRadius', 'diffuse']
          let selectRect = new Mesh(
            this.textMesh.curveRadius === 0 ? this.childrenGeometry : this.childrenCurvedGeometry,
            material
            // new MeshBasicMaterial({color: 0xffffff,side: DoubleSide,transparent: true, opacity:0.5})
          )
          this.selectionRectsMeshs.unshift(selectRect)
          this.textMesh.add(selectRect)    
      })
      this.textMesh.updateWorldMatrix(false,true)
    }

    updateHighlightTextUniforms(){
      if(
        this.prevCurveRadius === 0 && this.textMesh.curveRadius !== 0
        ||
        this.prevCurveRadius !== 0 && this.textMesh.curveRadius === 0
        ){
        this.prevCurveRadius = this.textMesh.curveRadius
        //update geometry
        this.selectionRectsMeshs.forEach((rect)=>{
          rect.geometry =  this.textMesh.curveRadius === 0 ? this.childrenGeometry : this.childrenCurvedGeometry
        })
      }
      this.selectionRectsMeshs.forEach((rect)=>{
        rect.material.uniforms.depthAndCurveRadius.value.y = this.textMesh.curveRadius
        if(this.textMesh.selectionColor != rect.material.color){
          //faster to check fo color change or to set needsUpdate true each time ? 
          //todo
          rect.material.color.set(this.textMesh.selectionColor)
          rect.material.needsUpdate = true
        }
      })
    }

    /**
     * Start watching change on the overlaying HTML such as browser dom translation in order to reflect it in the renderer context
     */
    startObservingMutation(){
      this.observer = new MutationObserver(this.mutationCallback.bind(this));
      this.observer.observe(this._domElText, { attributes: false, childList: true, subtree: false });
    }

    /**
     * When a change occurs on the overlaying HTML, it reflect it in the renderer context
     */
    mutationCallback(mutationsList, observer) {
        this.currentHTML = this._domElText.innerHTML
        this.textMesh.currentText = this.currentHTML.replace(/<(?!br\s*\/?)[^>]+>/g, '').replace(/<br\s*[\/]?>/gi, "\n");
        this.clearSelection()
        this.textMesh._needsSync = true;
        this.textMesh.sync()
    }

    destroy(){
      this.clearSelection()
      this.observer.disconnect()
      this._domElText.remove()
      this._domElSelectedText.remove()
      this.childrenGeometry.dispose()
      this.childrenCurvedGeometry.dispose()
    }    

  }

  return A11yManager
})()

export {
  A11yManager
}
