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

const makeSelectable = (textInstance, eventEmitter) => {

  const defaultSelectionColor = 0xffffff

  const tempMat4a = new Matrix4()
  const tempMat4b = new Matrix4()
  const tempVec3 = new Vector3()

  textInstance._domElSelectedText = document.createElement('p')
  textInstance.selectionStartIndex = 0;
  textInstance.selectionEndIndex = 0;
  textInstance.selectedText = null;

  textInstance.domContainer = document.documentElement
  textInstance.domContainer.appendChild(textInstance._domElSelectedText)

  textInstance._domElSelectedText.setAttribute('aria-hidden', 'true')
  textInstance._domElSelectedText.style = domOverlayBaseStyles

  textInstance.selectionRects = []
  textInstance.selectionRectsMeshs = []

  textInstance.prevCurveRadius = 0
  textInstance.isSelectable = true

  textInstance.childrenGeometry = new BoxBufferGeometry(1, 1, 0.1).translate(0.5, 0.5, 0.5)
  textInstance.childrenCurvedGeometry = new BoxBufferGeometry(1, 1, 0.1, 32).translate(0.5, 0.5, 0.5)

  textInstance.addEventListener('syncstart', function () {
    if (!this.selectable && this.selectionRects.length != 0)
      this.clearSelection()
  })

  /**
   * Given a local x/y coordinate in the text block plane, set the start position of the caret 
   * used in text selection 
   * @param {number} x
   * @param {number} y
   * @return {TextCaret | null}
   */
  textInstance.startCaret = function (textRenderInfo, x, y) {
    let caret = getCaretAtPoint(textRenderInfo, x, y)
    this.selectionStartIndex = caret.charIndex
    this.selectionEndIndex = caret.charIndex
    this.updateSelection(textRenderInfo)
    return caret
  }

  textInstance.clearSelection = function () {
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
  textInstance.moveCaret = function (textRenderInfo, x, y) {
    let caret = getCaretAtPoint(textRenderInfo, x, y)
    this.selectionEndIndex = caret.charIndex
    this.updateSelection(textRenderInfo)
    return caret
  }

  /**
   * update the selection visually and everything related to copy /paste
   */
  textInstance.updateSelection = function (textRenderInfo) {
    this.selectedText = this.text.substring(this.selectionStartIndex, this.selectionEndIndex)
    this.selectionRects = getSelectionRects(textRenderInfo, this.selectionStartIndex, this.selectionEndIndex)
    this._domElSelectedText.textContent = this.selectedText
    this.highlightText()
    this.selectDomText()
  }

  /**
   * Select the text contened in _domElSelectedText in order for it to reflect what's currently selected in the Text
   */
  textInstance.selectDomText = function () {
    const sel = document.getSelection()
    sel.removeAllRanges()
    const range = document.createRange()
    range.selectNodeContents(this._domElSelectedText); //sets Range
    sel.removeAllRanges(); //remove all ranges from selection
    sel.addRange(range);
  }

  /**
   * update the position of the overlaying HTML that contain
   * the selected text in order for it to be acessible through context menu copy
   */
  textInstance.updateSelectedDomPosition = function (renderer, camera) {
    console.log('updateSelectedDomPosition')
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

      const z = this.geometry.boundingBox.max.z
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
  textInstance._textRectToCssMatrix = function (minX, minY, maxX, maxY, z, renderer, camera) {
    const canvasRect = renderer.domElement.getBoundingClientRect()

    // element dimensions to geometry dimensions (flipping the y)
    tempMat4a.makeScale((maxX - minX) / 10, (minY - maxY) / 10, 1)
      .setPosition(tempVec3.set(minX, maxY, z))

    // geometry to world
    tempMat4a.premultiply(this.matrixWorld)

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
  textInstance.highlightText = function () {
    let THICKNESS = 0.25;
    //todo manage rect update in a cleaner way. Currently we recreate everything everytime
    //clean dispose of material no need to do it for geometry because we reuse the same
    this.selectionRectsMeshs.forEach((rect) => {
      if (rect.parent)
        rect.parent.remove(rect)
      rect.material.dispose()
    })
    this.selectionRectsMeshs = []

    this.selectionRects.forEach((rect) => {
      let material = createDerivedMaterial(
        this.selectionMaterial ? this.selectionMaterial : new MeshBasicMaterial({
          color: this.selectionColor ? this.selectionColor : defaultSelectionColor,
          transparent: true,
          opacity: 0.3,
          depthWrite: false
        }),
        {
          uniforms: {
            rect: {
              value: new Vector4(
                rect.left,
                rect.top,
                rect.right,
                rect.bottom
              )
            },
            depthAndCurveRadius: {
              value: new Vector2(
                (rect.top - rect.bottom) * THICKNESS,
                this.curveRadius
              )
            }
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
        this.curveRadius === 0 ? this.childrenGeometry : this.childrenCurvedGeometry,
        material
        // new MeshBasicMaterial({color: 0xffffff,side: DoubleSide,transparent: true, opacity:0.5})
      )
      this.selectionRectsMeshs.unshift(selectRect)
      this.add(selectRect)
    })
    this.updateWorldMatrix(false, true)
  }

  textInstance.updateHighlightTextUniforms = function () {
    if (
      this.prevCurveRadius === 0 && this.curveRadius !== 0
      ||
      this.prevCurveRadius !== 0 && this.curveRadius === 0
    ) {
      this.prevCurveRadius = this.curveRadius
      //update geometry
      this.selectionRectsMeshs.forEach((rect) => {
        rect.geometry = this.curveRadius === 0 ? this.childrenGeometry : this.childrenCurvedGeometry
      })
    }
    this.selectionRectsMeshs.forEach((rect) => {
      rect.material.uniforms.depthAndCurveRadius.value.y = this.curveRadius
      if (this.selectionColor != rect.material.color) {
        //faster to check fo color change or to set needsUpdate true each time ? 
        //todo
        rect.material.color.set(this.selectionColor)
        rect.material.needsUpdate = true
      }
    })
  }

  textInstance.addEventListener('beforerender', function () {
    this.updateHighlightTextUniforms()
  })

  textInstance.addEventListener('afterrender', function () {
    const renderer = this.renderer
    const camera = this.camera
    this.updateSelectedDomPosition(renderer, camera)
  })

}

export {
  makeSelectable
}
