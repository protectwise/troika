import { Object3DFacade } from 'troika-3d'
import { Text } from 'troika-three-text'
import { Vector3 } from '../../../../node_modules/three/src/Three.js'
import SelectionManagerFacade from './SelectionManagerFacade.js'

// Properties that will simply be forwarded to the TextMesh:
const TEXT_MESH_PROPS = [
  'text',
  'anchorX',
  'anchorY',
  'font',
  'fontSize',
  'letterSpacing',
  'lineHeight',
  'maxWidth',
  'overflowWrap',
  'textAlign',
  'textIndent',
  'whiteSpace',
  'material',
  'color',
  'colorRanges',
  'fillOpacity',
  'outlineOpacity',
  'outlineColor',
  'outlineWidth',
  'outlineOffsetX',
  'outlineOffsetY',
  'outlineBlur',
  'strokeColor',
  'strokeWidth',
  'strokeOpacity',
  'curveRadius',
  'depthOffset',
  'clipRect',
  'orientation',
  'glyphGeometryDetail',
  'sdfGlyphSize',
  'debugSDF'
]


/**
 * Facade wrapper for a TextMesh. All configuration properties of TextMesh
 * are accepted and proxied through directly.
 */
class Text3DFacade extends Object3DFacade {
  constructor(parent) {
    const mesh = new Text()
    mesh.geometry.boundingSphere.version = 0
    super(parent, mesh)

    const el = this._domEl = document.createElement('p')
    const elSel = this._domElSelectedText = document.createElement('p')
    //todo remove id
    el.id = "dodo"
    elSel.id = "selectedtext"
    elSel.setAttribute('aria-hidden','true')
    el.style = 'position:absolute;left:-99px;opacity:0;overflow:hidden;margin:0px;pointer-events:none;cursor:text;'
    elSel.style = 'position:absolute;left:-99px;opacity:0;overflow:hidden;margin:0px;pointer-events:none;font-size:100vh;'
      
    var canvas = this.getSceneFacade().parent._threeRenderer.domElement;


    canvas.addEventListener('contextmenu',(e)=>{
      elSel.style.pointerEvents = 'auto'
      window.setTimeout(()=>{elSel.style.pointerEvents = 'none'},50)
    })

    console.log(canvas.parentNode)

    canvas.parentNode.appendChild(el) //should insert into local element ( in the canvas direct parent ? )
    canvas.parentNode.appendChild(elSel) //should insert into local element ( in the canvas direct parent ? )

    this.selectable = false
    this.selectionStart = this.selectionEnd = -1
    this.onSyncStart = null
    this.onSyncComplete = null

    mesh.addEventListener('syncstart', e => {
      this.notifyWorld('text3DSyncStart')
      if (this.onSyncStart) {
        this.onSyncStart()
      }
    })
    mesh.addEventListener('synccomplete', e => {
      if (!this.isDestroying) {
        mesh.geometry.boundingSphere.version++
        this.afterUpdate()
        this.notifyWorld('text3DSyncComplete')
        this.requestRender()
        if (this.onSyncComplete) {
          this.onSyncComplete()
        }
      }
    })
  }

  get textRenderInfo() {
    return this.threeObject.textRenderInfo
  }

  afterUpdate() {
    const textMesh = this.threeObject
    TEXT_MESH_PROPS.forEach(prop => {
      textMesh[prop] = this[prop]
    })
    textMesh.sync()

    super.afterUpdate()

    var camera = this.getCameraFacade();
    //todo get canvas width
    var width = window.innerWidth, height = window.innerHeight;
    var widthHalf = width / 2, heightHalf = height / 2;

    //need to update box position if min / max boundingbox changed
    //right now I'm updating on each update
    var max  = new Vector3(0,0,0);
    var min  = new Vector3(0,0,0);
    this.threeObject.geometry.computeBoundingBox()
    max.copy(this.threeObject.geometry.boundingBox.max)
    max = max.project(camera.threeObject);
    min.copy(this.threeObject.geometry.boundingBox.min)
    min = min.project(camera.threeObject);
    max.x = ( max.x * widthHalf ) + widthHalf;
    max.y = - ( max.y * heightHalf ) + heightHalf;
    min.x = ( min.x * widthHalf ) + widthHalf;
    min.y = - ( min.y * heightHalf ) + heightHalf;
  

    this._domEl.style.left = min.x+'px';
    this._domEl.style.top = max.y+'px';
    this._domEl.style.width = max.x-min.x+'px';
    this._domEl.style.height = min.y-max.y+'px';

    if (this.text !== this._prevText) {
      this._domEl.textContent = this.text
      // Clear selection when text changes
      this.selectionStart = this.selectionEnd = -1
      this._prevText = this.text
    }

    this._updateSelection()
  }

  computeScreenSpaceBoundingBox(mesh, camera) {
    var vertices = mesh.geometry.vertices;
    var vertex = new Vector3();
    var min = new Vector3(1, 1, 1);
    var max = new Vector3(-1, -1, -1);
  
    // for (var i = 0; i < vertices.length; i++) {
    //   var vertexWorldCoord = vertex.copy(vertices[i])
      // var vertexScreenSpace = vertexWorldCoord.project(camera);
      // min.min(vertexScreenSpace);
      // max.max(vertexScreenSpace);
    // }
  
    // return new Box2(min, max);
  }

  normalizedToPixels(coord, renderWidthPixels, renderHeightPixels) {
    var halfScreen = new Vector2(renderWidthPixels/2, renderHeightPixels/2)
    return coord.clone().multiply(halfScreen);
  }

  _updateSelection() {
    const {selectable, selectionStart, selectionEnd} = this
    let selFacade = this._selectionFacade
    if (selectable !== this._selectable) {
      this._selectable = selectable
      if (selectable) {
        selFacade = this._selectionFacade = new SelectionManagerFacade(this, (start, end) => {
          this.selectedText = this.text.substring(start,end)
          this._domElSelectedText.textContent = this.selectedText;
          // console.log('camera',this.getCameraFacade() )




          // var box2 = this.computeScreenSpaceBoundingBox(this.threeObject,camera.threeObject)
          // console.log(box2);
          // console.log(this.normalizedToPixels(box2,1233,893))

          this.selectionStart = start
          this.selectionEnd = end
          this._updateSelection()
          this.requestRender()

          const sel = document.getSelection()
          sel.removeAllRanges()
          console.log('rangepre')
          const range = document.createRange()
            range.selectNodeContents(this._domElSelectedText); //sets Range
            sel.removeAllRanges(); //remove all ranges from selection
            sel.addRange(range);//add Range to a Selection.
            console.log('range')
        })
      } else {
        if (selFacade) {
          selFacade.destructor()
          selFacade = this._selectionFacade = null
        }
        this.selectionStart = this.selectionEnd = -1
      }
    }
    if (selFacade) {
      selFacade.textRenderInfo = this.threeObject.textRenderInfo
      selFacade.selectionStart = selectionStart
      selFacade.selectionEnd = selectionEnd
      selFacade.curveRadius = this.curveRadius || 0
      selFacade.clipRect = this.clipRect
      selFacade.renderOrder = this.renderOrder
      
      selFacade.afterUpdate()
    }

    if (selectionStart !== this._prevSelStart || selectionEnd !== this._prevSelEnd) {

      
      let selFacade = this._selectionFacade
      if(selFacade._itemsDict){
        console.log('blop',selFacade)
          
        var camera = this.getCameraFacade();
        var canvas = this.getSceneFacade().parent._threeRenderer.domElement;
        var width = canvas.width, height = canvas.height;
        var widthHalf = width / 2, heightHalf = height / 2;
  
        var max  = new Vector3(0,0,0);
        var min  = new Vector3(0,0,0);

        let i=0;
        for (let key in selFacade._itemsDict) {
          if(i===0){
            max.x  = Math.max(selFacade._itemsDict[key].left,selFacade._itemsDict[key].right);
            max.y  = Math.max(selFacade._itemsDict[key].top,selFacade._itemsDict[key].bottom);
            max.z  = selFacade._itemsDict[key].depth;
            min.x  = Math.min(selFacade._itemsDict[key].left,selFacade._itemsDict[key].right);
            min.y  = Math.min(selFacade._itemsDict[key].top,selFacade._itemsDict[key].bottom);
            min.z  = selFacade._itemsDict[key].depth;
          }else{
            max.x  = Math.max(max.x,selFacade._itemsDict[key].left,selFacade._itemsDict[key].right);
            max.y  = Math.max(max.y,selFacade._itemsDict[key].top,selFacade._itemsDict[key].bottom);
            max.z  = Math.max(selFacade._itemsDict[key].depth,max.z);
            min.x  = Math.min(min.x,selFacade._itemsDict[key].left,selFacade._itemsDict[key].right);
            min.y  = Math.min(min.y,selFacade._itemsDict[key].top,selFacade._itemsDict[key].bottom);
            min.z  = Math.min(selFacade._itemsDict[key].depth,min.z);
          }
          i++;
        }
  
        max = max.project(camera.threeObject);
        min = min.project(camera.threeObject);
        
        max.x = ( max.x * widthHalf ) + widthHalf;
        max.y = - ( max.y * heightHalf ) + heightHalf;
        min.x = ( min.x * widthHalf ) + widthHalf;
        min.y = - ( min.y * heightHalf ) + heightHalf;

  
        this._domElSelectedText.style.left = min.x+'px';
        this._domElSelectedText.style.top = max.y+'px';
        this._domElSelectedText.style.width = max.x-min.x+'px';
        this._domElSelectedText.style.height = min.y-max.y+'px';
  
      }
      
      this._prevSelStart = selectionStart
      this._prevSelEnd = selectionEnd

    }
    
  }

  destructor() {
    this.threeObject.dispose()
    //this._domEl.parentNode.removeChild(this._domEl)
    if (this._selectionFacade) {
      this._selectionFacade.destructor()
    }
    super.destructor()
  }
}

export default Text3DFacade