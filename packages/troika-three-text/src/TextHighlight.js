import {
  Mesh,
  MeshBasicMaterial,
  Vector4,
  Vector2,
  BoxBufferGeometry,
  Group
} from 'three'
import { createDerivedMaterial } from 'troika-three-utils'

const defaultSelectionColor = 0xffffff

const TextHighlight = /*#__PURE__*/(() => {

  /**
   * @class Text
   *
   * A ThreeJS Mesh that renders a string of text on a plane in 3D space using signed distance
   * fields (SDF).
   */
  class TextHighlight extends Group {
    constructor(parent) {
      super(parent)

      this.color = 'white'
      this.startIndex = 0
      this.endIndex = 0
      this.thickness = 0.25
      this.prevCurveRadius = 0
      this.childrenGeometry = new BoxBufferGeometry(1, 1, 0.1).translate(0.5, 0.5, 0.5)
      this.childrenCurvedGeometry = new BoxBufferGeometry(1, 1, 0.1, 32).translate(0.5, 0.5, 0.5)
    }

    /**
     * visually update the rendering of the text selection in the renderer context
     */
    highlightText() {
      //todo manage rect update in a cleaner way. Currently we recreate everything everytime
      //clean dispose of material no need to do it for geometry because we reuse the same
      this.parent.selectionRectsMeshs.forEach((rect) => {
        if (rect.parent)
          rect.parent.remove(rect)
        rect.material.dispose()
      })
      this.parent.selectionRectsMeshs = []

      this.parent.selectionRects.forEach((rect) => {
        let material = createDerivedMaterial(
          this.parent.selectionMaterial ? this.parent.selectionMaterial : new MeshBasicMaterial({
            color: this.parent.selectionColor ? this.parent.selectionColor : defaultSelectionColor,
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
                  (rect.top - rect.bottom) * this.thickness,
                  this.parent.curveRadius
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
          this.parent.curveRadius === 0 ? this.childrenGeometry : this.childrenCurvedGeometry,
          material
          // new MeshBasicMaterial({color: 0xffffff,side: DoubleSide,transparent: true, opacity:0.5})
        )
        this.parent.selectionRectsMeshs.unshift(selectRect)
        this.parent.add(selectRect)
      })
      this.parent.updateWorldMatrix(false, true)
    }

    updateHighlightTextUniforms() {
      if (
        this.prevCurveRadius === 0 && this.parent.curveRadius !== 0
        ||
        this.prevCurveRadius !== 0 && this.parent.curveRadius === 0
      ) {
        this.prevCurveRadius = this.parent.curveRadius
        //update geometry
        this.parent.selectionRectsMeshs.forEach((rect) => {
          rect.geometry = this.parent.curveRadius === 0 ? this.childrenGeometry : this.childrenCurvedGeometry
        })
      }
      this.parent.selectionRectsMeshs.forEach((rect) => {
        rect.material.uniforms.depthAndCurveRadius.value.y = this.parent.curveRadius
        if (this.parent.selectionColor != rect.material.color) {
          //faster to check fo color change or to set needsUpdate true each time ? 
          //todo
          rect.material.color.set(this.parent.selectionColor)
          rect.material.needsUpdate = true
        }
      })
    }

  }

  return TextHighlight
})()

export {
  TextHighlight
}
