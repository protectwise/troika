import {
  Mesh,
  MeshBasicMaterial,
  Vector4,
  Vector2,
  BoxBufferGeometry
} from 'three'
import { createDerivedMaterial } from 'troika-three-utils'

const defaultSelectionColor = 0xffffff

const TextHighlighter = /*#__PURE__*/(() => {

  /**
   * @class Text
   *
   * A ThreeJS Mesh that renders a string of text on a plane in 3D space using signed distance
   * fields (SDF).
   */
  class TextHighlighter {
    constructor(textInstance, config = {}) {
      const _config = Object.assign({
        thickness: 0.25
      }, config);

      this.textInstance = textInstance

      this.thickness = _config.thickness
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
      this.textInstance.selectionRectsMeshs.forEach((rect) => {
        if (rect.parent)
          rect.parent.remove(rect)
        rect.material.dispose()
      })
      this.textInstance.selectionRectsMeshs = []

      this.textInstance.selectionRects.forEach((rect) => {
        let material = createDerivedMaterial(
          this.textInstance.selectionMaterial ? this.textInstance.selectionMaterial : new MeshBasicMaterial({
            color: this.textInstance.selectionColor ? this.textInstance.selectionColor : defaultSelectionColor,
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
                  this.textInstance.curveRadius
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
          this.textInstance.curveRadius === 0 ? this.childrenGeometry : this.childrenCurvedGeometry,
          material
          // new MeshBasicMaterial({color: 0xffffff,side: DoubleSide,transparent: true, opacity:0.5})
        )
        this.textInstance.selectionRectsMeshs.unshift(selectRect)
        this.textInstance.add(selectRect)
      })
      this.textInstance.updateWorldMatrix(false, true)
    }

    updateHighlightTextUniforms() {
      if (
        this.prevCurveRadius === 0 && this.textInstance.curveRadius !== 0
        ||
        this.prevCurveRadius !== 0 && this.textInstance.curveRadius === 0
      ) {
        this.prevCurveRadius = this.textInstance.curveRadius
        //update geometry
        this.textInstance.selectionRectsMeshs.forEach((rect) => {
          rect.geometry = this.textInstance.curveRadius === 0 ? this.childrenGeometry : this.childrenCurvedGeometry
        })
      }
      this.textInstance.selectionRectsMeshs.forEach((rect) => {
        rect.material.uniforms.depthAndCurveRadius.value.y = this.textInstance.curveRadius
        if (this.textInstance.selectionColor != rect.material.color) {
          //faster to check fo color change or to set needsUpdate true each time ? 
          //todo
          rect.material.color.set(this.textInstance.selectionColor)
          rect.material.needsUpdate = true
        }
      })
    }

  }

  return TextHighlighter
})()

export {
  TextHighlighter
}
