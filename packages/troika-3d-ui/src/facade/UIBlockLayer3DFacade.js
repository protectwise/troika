import { Instanceable3DFacade } from 'troika-3d'
import { Color, Mesh, MeshBasicMaterial, PlaneGeometry, Vector2, Vector4 } from 'three'
import { createUIBlockLayerDerivedMaterial } from './UIBlockLayerDerivedMaterial.js'

const geometry = new PlaneGeometry(1, 1).translate(0.5, -0.5, 0)
const defaultMaterial = new MeshBasicMaterial({color: 0})
const emptyVec2 = Object.freeze(new Vector2())
const emptyVec4 = Object.freeze(new Vector4(0,0,0,0))

const shadowMaterialPropDefs = {
  // Create and update materials for shadows upon request:
  customDepthMaterial: {
    get() {
      return this.material.getDepthMaterial()
    },
    set(m) {}
  },
  customDistanceMaterial: {
    get() {
      return this.material.getDistanceMaterial()
    },
    set(m) {}
  }
}

const instanceMeshesByKey = new Map()

/**
 * A single layer in a UI Block's rendering, e.g. background or border. All layers honor
 * border radius, which is calculated shader-side for perfectly smooth curves at any scale,
 * with antialiasing.
 *
 * Layer meshes are rendered via GPU instancing when possible -- specifically when they share
 * the same Material instance, layering depth, and shadow behavior.
 *
 * You shouldn't have to use this directly; UIBlock3DFacade will create these as needed
 * based on background/border styles.
 */
class UIBlockLayer3DFacade extends Instanceable3DFacade {
  constructor(parent) {
    super(parent)

    this._colorObj = new Color()

    // Properties
    this.size = emptyVec2
    this.borderRadius = emptyVec4
    this.borderWidth = emptyVec4
    this.color = 0
    this.isBorder = false
    this.material = defaultMaterial
  }

  afterUpdate() {
    let {material, depthOffset, castShadow, receiveShadow, color, renderOrder} = this
    if (!material) { material = defaultMaterial }

    // Find or create the instanced mesh
    let meshKey = `${material.id}|${renderOrder}|${depthOffset}|${castShadow}|${receiveShadow}`
    if (meshKey !== this._prevMeshKey) {
      let mesh = instanceMeshesByKey.get(meshKey)
      if (!mesh) {
        let derivedMaterial = createUIBlockLayerDerivedMaterial(material)
        derivedMaterial.polygonOffset = !!this.depthOffset
        derivedMaterial.polygonOffsetFactor = derivedMaterial.polygonOffsetUnits = this.depthOffset || 0
        // dispose the derived material when its base material is disposed:
        material.addEventListener('dispose', function onDispose() {
          material.removeEventListener('dispose', onDispose)
          derivedMaterial.dispose()
        })

        mesh = new Mesh(geometry, derivedMaterial)
        mesh._instanceKey = meshKey
        mesh.castShadow = castShadow
        mesh.receiveShadow = receiveShadow
        mesh.renderOrder = renderOrder
        Object.defineProperties(mesh, shadowMaterialPropDefs)
        instanceMeshesByKey.set(meshKey, mesh)
      }
      this.instancedThreeObject = mesh
      this._prevMeshKey = meshKey
    }

    // Set material uniform values
    this.setInstanceUniform('uTroikaBlockSize', this.size)
    this.setInstanceUniform('uTroikaCornerRadii', this.borderRadius)
    this.setInstanceUniform('uTroikaClipRect', this.clipRect)
    this.setInstanceUniform('uTroikaBorderWidth', this.isBorder ? this.borderWidth : emptyVec4)
    if (color !== this._lastColor) {
      this._lastColor = color
      this.setInstanceUniform('diffuse', new Color(color))
    }

    super.afterUpdate()
  }

  getBoundingSphere() {
    return null //parent will handle bounding sphere and raycasting
  }
}


export default UIBlockLayer3DFacade
