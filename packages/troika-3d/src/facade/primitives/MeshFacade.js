import Object3DFacade from '../Object3DFacade.js'
import {
  BufferGeometry,
  Mesh,
  MeshBasicMaterial, MeshDepthMaterial, MeshDistanceMaterial,
  MeshLambertMaterial, MeshMatcapMaterial, MeshNormalMaterial,
  MeshPhongMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, MeshToonMaterial
} from 'three'

const dummyGeometry = new BufferGeometry()
const dummyMaterial = new MeshBasicMaterial()

export const MESH_MATERIALS = {
  'basic': MeshBasicMaterial,
  'depth': MeshDepthMaterial,
  'distance': MeshDistanceMaterial,
  'lambert': MeshLambertMaterial,
  'matcap': MeshMatcapMaterial,
  'normal': MeshNormalMaterial,
  'phong': MeshPhongMaterial,
  'physical': MeshPhysicalMaterial,
  'standard': MeshStandardMaterial,
  'toon': MeshToonMaterial,
}



/**
 * A facade for rendering a Mesh. The following properties are supported:
 *
 * @member {Geometry|BufferGeometry} geometry - The geometry instance to be used for this
 *         mesh. It's recommended to use a shared geometry instance between meshes when possible.
 * @member {string|class|Material} material - The type of the material to be used for this mesh. Can either
 *         be a reference to a Material class, a Material instance, or one of the strings in the `MESH_MATERIALS`
 *         enum. Defaults to 'standard'.
 * @member {boolean} autoDisposeGeometry - Whether the geometry should be automatically disposed when this
 *         mesh is removed from the scene. Defaults to `false`. You can set it to `true` as a memory optimization
 *         if the geometry is not expected to return to the scene later, but this is not generally needed.
 * @member {boolean} autoDisposeMaterial - Whether the material's shader program should be automatically disposed
 *         when this mesh is removed from the scene. Defaults to `false`. You can set it to `true` as a memory
 *         optimization if the material uses a custom shader that is not expected to be used again, but this is
 *         not generally needed. Note that this will _not_ dispose any textures assigned to the material.
 *
 * Also, for convenience, properties of the material can be set via `material.*` shortcut properties. For example,
 * passing `{"material.transparent": true, "material.opacity": 0.5}` will set the material to half-opaque
 * transparency. Colors will call `set` on the Color object for that material property.
 */
export class MeshFacade extends Object3DFacade {
  constructor (parent) {
    super(parent, new Mesh(dummyGeometry, dummyMaterial))
    this.material = 'standard'
    this.autoDisposeGeometry = false
    this.autoDisposeMaterial = false
    this._dirtyMtlProps = null
  }

  afterUpdate() {
    let {geometry, material, threeObject} = this

    if ((geometry || dummyGeometry) !== threeObject.geometry) {
      if (this.autoDisposeGeometry) {
        threeObject.geometry.dispose()
      }
      threeObject.geometry = geometry || dummyGeometry
    }

    // Resolve `material` prop to a Material instance
    if (material !== this._lastMtl) {
      this._lastMtl = material
      if (typeof material === 'string') {
        material = new (MESH_MATERIALS[material] || MeshStandardMaterial)()
      }
      else if (material && material.isMaterial) {
        // material = material
      }
      else if (typeof material === 'function') {
        material = new material()
      }
      else {
        material = new MeshStandardMaterial()
      }
      if (threeObject.material !== material) {
        if (this.autoDisposeMaterial) {
          threeObject.material.dispose()
        }
        threeObject.material = material
      }
    }

    // If any of the material setters were called, sync the dirty values to the material
    const dirties = this._dirtyMtlProps
    if (dirties) {
      threeObject.material.setValues(dirties)
      this._dirtyMtlProps = null
    }

    super.afterUpdate()
  }

  destructor () {
    if (this.autoDisposeGeometry) {
      this.threeObject.geometry.dispose()
    }
    if (this.autoDisposeMaterial) {
      this.threeObject.material.dispose()
    }
    super.destructor()
  }
}

// For all of the known mesh materials, add `material.*` setters for all of their
// supported properties. The setters will update a "dirty" object which will then be
// applied to the material during afterUpdate; this lets us only deal with the specific
// material props that have been set rather than having to iterate over all props.
const ignoreMaterialProps = {type:1, id:1, uuid:1, version:1}
Object.keys(MESH_MATERIALS).forEach(key => {
  let material = new MESH_MATERIALS[key]()
  for (let mtlProp in material) {
    if (material.hasOwnProperty(mtlProp) && !ignoreMaterialProps.hasOwnProperty(mtlProp)) {
      Object.defineProperty(MeshFacade.prototype, `material.${mtlProp}`, {
        enumerable: true,
        configurable: true,
        get() {
          const dirties = this._dirtyMtlProps
          return (dirties && mtlProp in dirties) ? dirties[mtlProp] : this.threeObject.material[mtlProp]
        },
        set(value) {
          const dirties = this._dirtyMtlProps || (this._dirtyMtlProps = Object.create(null))
          dirties[mtlProp] = value
        }
      })
    }
  }
})


