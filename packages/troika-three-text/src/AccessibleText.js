import {
  Mesh,
  MeshBasicMaterial,
  Vector4,
  Vector3,
  Vector2,
  BoxBufferGeometry
} from 'three'
import { createDerivedMaterial } from 'troika-three-utils'
import { getSelectionRects, getCaretAtPoint } from './selectionUtils'

const AccessibleText = /*#__PURE__*/(() => {

  const defaultSelectionColor = 0xffffff

  /**
   * @class Text
   *
   * A ThreeJS Mesh that renders a string of text on a plane in 3D space using signed distance
   * fields (SDF).
   */
  class AccessibleText {
    constructor(textMesh) {

      this.textMesh = textMesh

      this._domElSelectedText = document.createElement('p')
      this._domElText = document.createElement(this.tagName ? this.tagName : 'p')
      this.selectionStartIndex = 0;
      this.selectionEndIndex = 0;
      this.selectedText = null;

      this.domContainer = this.domContainer ? this.domContainer : document.body
      this.domContainer.appendChild(this._domElSelectedText)
      this.domContainer.appendChild(this._domElText)
      this.domContainer.style.position = 'relative'

      this._domElSelectedText.setAttribute('aria-hidden','true')
      this._domElText.style = 'position:absolute;left:-99px;opacity:0;overflow:hidden;margin:0px;pointer-events:none;font-size:100vh;display:flex;align-items: center;line-height: 0px!important;line-break: anywhere;'
      this._domElSelectedText.style = 'position:absolute;left:-99px;opacity:0;overflow:hidden;margin:0px;pointer-events:none;font-size:100vh;'

      this.startObservingMutation()

      this.selectionRects = []

      this.prevText = ''
      this.currentText = ''
      this.prevHTML = ''
      this.currentHTML = ''
      this.prevCurveRadius = 0

      /* create it only once */
      this.childrenGeometry = new BoxBufferGeometry(1, 1, 0.1).translate(0.5, 0.5, 0.5)
      /* create it only once */
      this.childrenCurvedGeometry = new BoxBufferGeometry(1, 1, 0.1,32).translate(0.5, 0.5, 0.5)

      /**
       * @member {THREE.Material} selectionMaterial
       * Defines a _base_ material to be used when rendering the text. This material will be
       * automatically replaced with a material derived from it, that adds shader code to
       * decrease the alpha for each fragment (pixel) outside the text glyphs, with antialiasing.
       * By default it will derive from a simple white MeshBasicMaterial, but you can use any
       * of the other mesh materials to gain other features like lighting, texture maps, etc.
       *
       * Also see the `selectionColor` shortcut property.
       */
      this.selectionMaterial = null

      /**
       * @member {string|number|THREE.Color} selectionColor
       * This is a shortcut for setting the `color` of the text's material. You can use this
       * if you don't want to specify a whole custom `material`. Also, if you do use a custom
       * `material`, this color will only be used for this particuar Text instance, even if
       * that same material instance is shared across multiple Text objects.
       */
      this.selectionColor = defaultSelectionColor
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
      this.updateSelectedDomPosition()
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
      this.updateSelectedDomPosition()
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
    updateDomPosition(){
      let contbbox = this.domContainer.getBoundingClientRect()
      let bbox = this.textMesh.renderer.domElement.getBoundingClientRect()
      let width = bbox.width
      let height = bbox.height
      let left = bbox.left - contbbox.left
      let top = bbox.top - contbbox.top
      var widthHalf = width / 2, heightHalf = height / 2;

      var max  = new Vector3(0,0,0);
      var min  = new Vector3(0,0,0);

      this.textMesh.geometry.computeBoundingBox()
      max.copy(this.textMesh.geometry.boundingBox.max).applyMatrix4( this.textMesh.matrixWorld );
      min.copy(this.textMesh.geometry.boundingBox.min).applyMatrix4( this.textMesh.matrixWorld );

      var bboxVectors = 
      [
        new Vector3(max.x,max.y,max.z),
        new Vector3(min.x,max.y,max.z),
        new Vector3(min.x,min.y,max.z),
        new Vector3(max.x,min.y,max.z),
        new Vector3(max.x,max.y,min.z),
        new Vector3(min.x,max.y,min.z),
        new Vector3(min.x,min.y,min.z),
        new Vector3(max.x,min.y,min.z)
      ]

      let xmin = null
      let xmax = null
      let ymin = null
      let ymax = null


      bboxVectors.forEach(vec => {
        vec.project(this.textMesh.camera);
      });
      xmin = bboxVectors[0].x
      xmax = bboxVectors[0].x
      ymin = bboxVectors[0].y
      ymax = bboxVectors[0].y
      bboxVectors.forEach(vec => {
        xmin = xmin > vec.x ? vec.x : xmin
        xmax = xmax < vec.x ? vec.x : xmax
        ymin = ymin > vec.y ? vec.y : ymin
        ymax = ymax < vec.y ? vec.y : ymax
      });

      xmax = ( xmax * widthHalf ) + widthHalf;
      ymax = - ( ymax * heightHalf ) + heightHalf;
      xmin = ( xmin * widthHalf ) + widthHalf;
      ymin = - ( ymin * heightHalf ) + heightHalf;

      this._domElText.style.left = xmin+left+'px';
      this._domElText.style.top = ymax+top+'px';
      this._domElText.style.width = Math.abs(xmax-xmin)+'px';
      this._domElText.style.height = Math.abs(ymax-ymin)+'px';
      this._domElText.style.fontSize = Math.abs(ymax-ymin)+'px';
    }

    /**
     * update the position of the overlaying HTML that contain
     * the selected text in order for it to be acessible through context menu copy
     */
    updateSelectedDomPosition(){
      if(this.textMesh.children.length === 0){
        this._domElSelectedText.style.width = '0px';
        this._domElSelectedText.style.height = '0px';
        return
      }
      
      let contbbox = this.domContainer.getBoundingClientRect()
      let bbox = this.textMesh.renderer.domElement.getBoundingClientRect()
      let width = bbox.width
      let height = bbox.height
      let left = bbox.left - contbbox.left
      let top = bbox.top - contbbox.top
      var widthHalf = width / 2, heightHalf = height / 2;

      var max  = new Vector3(0,0,0);
      var min  = new Vector3(0,0,0);


      this.textMesh.children[0].geometry.computeBoundingBox()
      this.textMesh.children[this.textMesh.children.length-1].geometry.computeBoundingBox()

      // max.copy(this.children[0].geometry.boundingBox.max)
      // min.copy(this.children[0].geometry.boundingBox.min)
      // max.max(this.children[this.children.length-1].geometry.boundingBox.max).applyMatrix4( this.children[this.children.length-1].matrixWorld );
      // min.min(this.children[this.children.length-1].geometry.boundingBox.min).applyMatrix4( this.children[this.children.length-1].matrixWorld );

      let i=0;
      for (let key in this.selectionRects) {
        if(i===0){
          max.x  = Math.max(this.selectionRects[key].left,this.selectionRects[key].right);
          max.y  = Math.max(this.selectionRects[key].top,this.selectionRects[key].bottom);
          max.z  = this.textMesh.geometry.boundingBox.max.z;
          min.x  = Math.min(this.selectionRects[key].left,this.selectionRects[key].right);
          min.y  = Math.min(this.selectionRects[key].top,this.selectionRects[key].bottom);
          min.z  = this.textMesh.geometry.boundingBox.min.z;
        }else{
          max.x  = Math.max(max.x,this.selectionRects[key].left,this.selectionRects[key].right);
          max.y  = Math.max(max.y,this.selectionRects[key].top,this.selectionRects[key].bottom);
          min.x  = Math.min(min.x,this.selectionRects[key].left,this.selectionRects[key].right);
          min.y  = Math.min(min.y,this.selectionRects[key].top,this.selectionRects[key].bottom);
        }
        i++;
      }

      var bboxVectors = 
      [
        new Vector3(max.x,max.y,max.z).applyMatrix4( this.textMesh.matrixWorld ),
        new Vector3(min.x,max.y,max.z).applyMatrix4( this.textMesh.matrixWorld ),
        new Vector3(min.x,min.y,max.z).applyMatrix4( this.textMesh.matrixWorld ),
        new Vector3(max.x,min.y,max.z).applyMatrix4( this.textMesh.matrixWorld ),
        new Vector3(max.x,max.y,min.z).applyMatrix4( this.textMesh.matrixWorld ),
        new Vector3(min.x,max.y,min.z).applyMatrix4( this.textMesh.matrixWorld ),
        new Vector3(min.x,min.y,min.z).applyMatrix4( this.textMesh.matrixWorld ),
        new Vector3(max.x,min.y,min.z).applyMatrix4( this.textMesh.matrixWorld )
      ]

      let xmin = null
      let xmax = null
      let ymin = null
      let ymax = null

      bboxVectors.forEach(vec => {
        vec.project(this.textMesh.camera);
      });
      xmin = bboxVectors[0].x
      xmax = bboxVectors[0].x
      ymin = bboxVectors[0].y
      ymax = bboxVectors[0].y
      bboxVectors.forEach(vec => {
        xmin = xmin > vec.x ? vec.x : xmin
        xmax = xmax < vec.x ? vec.x : xmax
        ymin = ymin > vec.y ? vec.y : ymin
        ymax = ymax < vec.y ? vec.y : ymax
      });

      xmax = ( xmax * widthHalf ) + widthHalf;
      ymax = - ( ymax * heightHalf ) + heightHalf;
      xmin = ( xmin * widthHalf ) + widthHalf;
      ymin = - ( ymin * heightHalf ) + heightHalf;

      this._domElSelectedText.style.left = xmin+left+'px';
      this._domElSelectedText.style.top = ymax+top+'px';
      this._domElSelectedText.style.width = Math.abs(xmax-xmin)+'px';
      this._domElSelectedText.style.height = Math.abs(ymax-ymin)+'px';
    }

    /**
     * visually update the rendering of the text selection in the renderer context
     */
    highlightText() {

      let THICKNESS = 0.25;

      //todo manage rect update in a cleaner way. Currently we recreate everything everytime

      //clean dispose of material no need to do it for geometry because we reuse the same
      this.textMesh.children.forEach((child)=>{
        child.material.dispose()
      })
      this.textMesh.children = []

      for (let key in this.selectionRects) {
        let material = createDerivedMaterial(
        this.selectionMaterial ? this.selectionMaterial : new MeshBasicMaterial({
          color:this.selectionColor ? this.selectionColor : defaultSelectionColor,
          transparent: true,
          opacity: 0.3,
          depthWrite: false
        }),
        {
          uniforms: {
            rect: {value: new Vector4(
              this.selectionRects[key].left ,
              this.selectionRects[key].top ,
              this.selectionRects[key].right ,
              this.selectionRects[key].bottom 
            )},
            depthAndCurveRadius: {value: new Vector2(
              (this.selectionRects[key].top - this.selectionRects[key].bottom)*THICKNESS,
              this.curveRadius
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
        // selectRect.position.x = -1
        // selectRect.position.y = -1
        this.textMesh.add(selectRect)        
      }
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
        for (let key in this.selectionRects) {
          this.textMesh.children[key].geometry =  this.textMesh.curveRadius === 0 ? this.childrenGeometry : this.childrenCurvedGeometry
        }
      }
      for (let key in this.selectionRects) {
        this.textMesh.children[key].material.uniforms.depthAndCurveRadius.value.y = this.textMesh.curveRadius
        if(this.selectionColor != this.textMesh.children[key].material.color){
          //faster to check fo color change or to set needsUpdate true each time ? 
          //to discuss
          this.textMesh.children[key].material.color.set(this.selectionColor)
          this.textMesh.children[key].material.needsUpdate = true
        }
      }
    }

    /**
     * Start watching change on the overlaying HTML such as browser dom translation in order to reflect it in the renderer context
     */
    startObservingMutation(){
      //todo right now each Text class has its own MutationObserver, maybe it cn cause issues if used with multiple Text
      this.observer = new MutationObserver(this.mutationCallback.bind(this));
      // Start observing the target node for change ( e.g. page translate )
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
    
    /**
     * stop monitoring dom change
     */
    stopObservingMutation(){
      this.observer.disconnect();
    }

    /**
     * @override Custom raycasting to test against the whole text block's max rectangular bounds
     * TODO is there any reason to make this more granular, like within individual line or glyph rects?
     */
    raycast(raycaster, intersects) {
      const {textRenderInfo, curveRadius} = this
      if (textRenderInfo) {
        const bounds = textRenderInfo.blockBounds
        const raycastMesh = curveRadius ? getCurvedRaycastMesh() : getFlatRaycastMesh()
        const geom = raycastMesh.geometry
        const {position, uv} = geom.attributes
        for (let i = 0; i < uv.count; i++) {
          let x = bounds[0] + (uv.getX(i) * (bounds[2] - bounds[0]))
          const y = bounds[1] + (uv.getY(i) * (bounds[3] - bounds[1]))
          let z = 0
          if (curveRadius) {
            z = curveRadius - Math.cos(x / curveRadius) * curveRadius
            x = Math.sin(x / curveRadius) * curveRadius
          }
          position.setXYZ(i, x, y, z)
        }
        geom.boundingSphere = this.geometry.boundingSphere
        geom.boundingBox = this.geometry.boundingBox
        raycastMesh.matrixWorld = this.matrixWorld
        raycastMesh.material.side = this.material.side
        tempArray.length = 0
        raycastMesh.raycast(raycaster, tempArray)
        for (let i = 0; i < tempArray.length; i++) {
          tempArray[i].object = this
          intersects.push(tempArray[i])
        }
      }
    }

  }

  return AccessibleText
})()

export {
  AccessibleText
}
