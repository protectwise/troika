import { Object3DFacade } from 'troika-3d'
import { Color, Mesh, MeshBasicMaterial, PlaneBufferGeometry, Vector4 } from 'three'
import { createUIBlockLayerDerivedMaterial } from './UIBlockLayerDerivedMaterial.js'
const geometry = new PlaneBufferGeometry(1, 1).translate(0.5, -0.5, 0)
const defaultBgMaterial = new MeshBasicMaterial({color: 0})
const noclip = Object.freeze(new Vector4())

const shadowMaterialPropDefs = {
  // Create and update materials for shadows upon request:
  customDepthMaterial: {
    get() {
      return this.material.getDepthMaterial()
    }
  },
  customDistanceMaterial: {
    get() {
      return this.material.getDistanceMaterial()
    }
  }
}

/**
 * A single layer in a UI Block's rendering, e.g. background or border. All layers honor
 * border radius, which is calculated shader-side for perfectly smooth curves at any scale,
 * with antialiasing.
 *
 * You shouldn't have to use this directly; UIBlock3DFacade will create these as needed
 * based on background/border styles.
 */
class UIBlockLayer3DFacade extends Object3DFacade {
  constructor(parent) {
    const mesh = new Mesh(geometry, defaultBgMaterial)
    mesh.frustumCulled = false //TODO moot if we make this an Instanceable, otherwise need to fix culling by transformed size
    Object.defineProperties(mesh, shadowMaterialPropDefs)

    super(parent, mesh)

    this._colorObj = new Color()

    // Properties
    // this.size = new Vector2()
    // this.borderRadius = new Vector4()
    // this.borderWidth = new Vector4()
    // this.color = 0
    // this.material = null
    // this.isBorder = false
  }

  afterUpdate() {
    const {color} = this

    // Ensure we're using an upgraded material
    const layerMaterial = this.threeObject.material = this._getUpgradedMaterial()

    layerMaterial.polygonOffset = !!this.depthOffset
    layerMaterial.polygonOffsetFactor = layerMaterial.polygonOffsetUnits = this.depthOffset || 0

    // Set material uniform values
    const uniforms = layerMaterial.uniforms
    uniforms.uTroikaBlockSize.value = this.size
    uniforms.uTroikaCornerRadii.value = this.borderRadius
    uniforms.uTroikaClipRect.value = this.clipRect || noclip
    if (this.isBorder) {
      uniforms.uTroikaBorderWidth.value = this.borderWidth
    }
    if (color !== this._lastColor) {
      this._colorObj.set(color)
      this._lastColor = color
    }

    super.afterUpdate()
  }

  getBoundingSphere() {
    return null //parent will handle bounding sphere and raycasting
  }

  _getUpgradedMaterial() {
    const baseMaterial = this.material || defaultBgMaterial
    let upgradedMaterial = this._upgradedMaterial
    if (!upgradedMaterial || upgradedMaterial.baseMaterial !== baseMaterial) {
      if (upgradedMaterial) {
        upgradedMaterial.dispose()
      }
      upgradedMaterial = this._upgradedMaterial = createUIBlockLayerDerivedMaterial(baseMaterial, this.isBorder)
      upgradedMaterial.color = this._colorObj

      // dispose the derived material when its base material is disposed:
      baseMaterial.addEventListener('dispose', function onDispose() {
        baseMaterial.removeEventListener('dispose', onDispose)
        upgradedMaterial.dispose()
      })
    }
    return upgradedMaterial
  }
}


export default UIBlockLayer3DFacade
