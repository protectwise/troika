import { BoxBufferGeometry, Group, Mesh, MeshBasicMaterial, Vector4 } from 'three'
import { createDerivedMaterial } from 'troika-three-utils'
import { getSelectionRects } from '../selectionUtils.js'

const RangeHighlight = /*#__PURE__*/(() => {
  const boxTemplateGeom = new BoxBufferGeometry(1, 1, 1, 32).translate(0.5, 0.5, 0.5)

  const defaultBaseMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.3,
    depthWrite: false
  })

  // TODO: This should build a single mesh using an instanced geometry for each rect,
  //   rather than separate mesh objects, to save on draw calls.

  class RangeHighlight extends Group {
    constructor (textInstance) {
      super()

      this.textInstance = textInstance
      textInstance.addEventListener('synccomplete', () => {
        this._sync()
      })
      this.color = null
      this.startIndex = -1
      this.endIndex = -1
      this.depth = 0.1
    }

    setRange (start, end) {
      this.startIndex = start
      this.endIndex = end
      this._sync()
    }

    _sync () {
      const { textInstance, children } = this
      const rects = getSelectionRects(textInstance.textRenderInfo, this.startIndex, this.endIndex) //immutably cached
      if (rects !== this._prevRects) {
        this._prevRects = rects
        // Reconcile rects to RectMesh child list
        while (children.length > (rects ? rects.length : 0)) {
          children.pop().dispose()
        }
        if (rects) {
          rects.forEach((rect, i) => {
            if (!children[i]) {
              this.add(new RectMesh(textInstance))
            }
            children[i].rect = new Vector4(rect.left, rect.top, rect.right, rect.bottom)
            children[i].depth = this.depth
          })
        }
      }
    }
  }


  class RectMesh extends Mesh {
    constructor (textInstance) {
      const geometry = boxTemplateGeom.clone()

      // Proxy boundingBox/Sphere to the Text's geometry
      Object.defineProperties(geometry, {
        boundingBox: {
          get () {
            return textInstance.geometry.boundingBox
          }
        },
        boundingSphere: {
          get () {
            return textInstance.geometry.boundingSphere
          }
        }
      })

      super(geometry, defaultBaseMaterial)

      this.textInstance = textInstance
      textInstance.addEventListener('dispose', () => {
        this.dispose()
      })
    }

    get material () {
      let derivedMaterial = this._derivedMaterial
      const baseMaterial = this._baseMaterial || this._defaultMaterial || (this._defaultMaterial = defaultBaseMaterial.clone())
      if (!derivedMaterial || derivedMaterial.baseMaterial !== baseMaterial) {
        derivedMaterial = this._derivedMaterial = createRectsDerivedMaterial(baseMaterial)
        // dispose the derived material when its base material is disposed:
        baseMaterial.addEventListener('dispose', function onDispose () {
          baseMaterial.removeEventListener('dispose', onDispose)
          derivedMaterial.dispose()
        })
      }
      return derivedMaterial
    }

    set material (baseMaterial) {
      this._baseMaterial = baseMaterial
    }

    dispose () {
      this.geometry.dispose()
    }

    onBeforeRender () {
      const { uniforms } = this.material
      uniforms.rect.value = this.rect
      uniforms.curveRadius.value = this.textInstance.curveRadius || 0
      uniforms.depth.value = this.depth * this.textInstance.fontSize
    }
  }

  function createRectsDerivedMaterial (baseMaterial) {
    return createDerivedMaterial(baseMaterial, {
      chained: true,
      uniforms: {
        // TODO clipRect
        depth: { value: 0 },
        curveRadius: { value: 0 },
        rect: { value: new Vector4() }
      },
      vertexDefs: `
uniform float depth;
uniform float curveRadius;
uniform vec4 rect;`,
      vertexTransform: `
position.x = mix(rect.x, rect.z, position.x);
position.y = mix(rect.w, rect.y, position.y);
position.z = mix(-depth * 0.5, depth * 0.5, position.z);
if (curveRadius != 0.0) {
  float angle = position.x / curveRadius;
  position.xz = vec2(sin(angle) * (curveRadius - position.z), curveRadius - cos(angle) * (curveRadius - position.z));
  // TODO fix normals: normal.xz = vec2(sin(angle), cos(angle));
}`
    })
  }

  return RangeHighlight
})()

export {
  RangeHighlight
}
