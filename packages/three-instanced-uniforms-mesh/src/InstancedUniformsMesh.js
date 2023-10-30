import { InstancedBufferAttribute, InstancedMesh, MeshBasicMaterial } from 'three'
import { getShadersForMaterial } from 'troika-three-utils'
import { createInstancedUniformsDerivedMaterial } from './InstancedUniformsDerivedMaterial.js'

export class InstancedUniformsMesh extends InstancedMesh {
  constructor (geometry, material, count) {
    super(geometry, material, count)
    this._maxCount = count;
    this._instancedUniformNames = [] //treated as immutable
  }

  /*
   * Getter/setter for automatically wrapping the user-supplied geometry with one that will
   * carry our extra InstancedBufferAttribute(s). We do the wrapping lazily on _read_ rather
   * than write to avoid unnecessary wrapping on transient values.
   */
  get geometry () {
    let derivedGeom = this._derivedGeometry
    const baseGeom = this._baseGeometry
    if (!derivedGeom || derivedGeom.baseGeometry !== baseGeom) {
      derivedGeom = this._derivedGeometry = Object.create(baseGeom)
      derivedGeom.baseGeometry = baseGeom
      derivedGeom.attributes = Object.create(baseGeom.attributes)
      // dispose the derived geometry when its base geometry is disposed:
      baseGeom.addEventListener('dispose', function onDispose () {
        baseGeom.removeEventListener('dispose', onDispose)
        derivedGeom.dispose()
      })
    }
    return derivedGeom
  }

  set geometry (geometry) {
    // Extend the geometry so we can add our instancing attributes but inherit everything else
    this._baseGeometry = geometry
  }

  /*
   * Getter/setter for automatically wrapping the user-supplied material with our upgrades. We do the
   * wrapping lazily on _read_ rather than write to avoid unnecessary wrapping on transient values.
   */
  get material () {
    let derivedMaterial = this._derivedMaterial
    const baseMaterial = this._baseMaterial || this._defaultMaterial || (this._defaultMaterial = new MeshBasicMaterial())
    if (!derivedMaterial || derivedMaterial.baseMaterial !== baseMaterial) {
      derivedMaterial = this._derivedMaterial = createInstancedUniformsDerivedMaterial(baseMaterial)
      // dispose the derived material when its base material is disposed:
      baseMaterial.addEventListener('dispose', function onDispose () {
        baseMaterial.removeEventListener('dispose', onDispose)
        derivedMaterial.dispose()
      })
    }
    derivedMaterial.setUniformNames(this._instancedUniformNames)
    return derivedMaterial
  }

  set material (baseMaterial) {
    if (Array.isArray(baseMaterial)) {
      throw new Error('InstancedUniformsMesh does not support multiple materials')
    }
    // Unwrap already-derived materials
    while (baseMaterial && baseMaterial.isInstancedUniformsMaterial) {
      baseMaterial = baseMaterial.baseMaterial
    }
    this._baseMaterial = baseMaterial
  }

  get customDepthMaterial () {
    return this.material.getDepthMaterial()
  }

  get customDistanceMaterial () {
    return this.material.getDistanceMaterial()
  }

  /**
   * Set the value of a shader uniform for a single instance.
   * @param {string} name - the name of the shader uniform
   * @param {number} index - the index of the instance to set the value for
   * @param {number|Vector2|Vector3|Vector4|Color|Array|Matrix3|Matrix4|Quaternion} value - the uniform value for this instance
   */
  setUniformAt (name, index, value) {
    const attrs = this.geometry.attributes
    const attrName = `troika_attr_${name}`
    let attr = attrs[attrName]
    if (!attr) {
      const defaultValue = getDefaultUniformValue(this._baseMaterial, name)
      const itemSize = getItemSizeForValue(defaultValue)
      attr = attrs[attrName] = new InstancedBufferAttribute(new Float32Array(itemSize * this._maxCount), itemSize)
      // Fill with default value:
      if (defaultValue !== null) {
        for (let i = 0; i < this._maxCount; i++) {
          setAttributeValue(attr, i, defaultValue)
        }
      }
      this._instancedUniformNames = [...this._instancedUniformNames, name]
    }
    setAttributeValue(attr, index, value)
    attr.needsUpdate = true
  }

  /**
   * Unset all instance-specific values for a given uniform, reverting back to the original
   * uniform value for all.
   * @param {string} name
   */
  unsetUniform (name) {
    this.geometry.deleteAttribute(`troika_attr_${name}`)
    this._instancedUniformNames = this._instancedUniformNames.filter(n => n !== name)
  }
}

function setAttributeValue (attr, index, value) {
  let size = attr.itemSize
  if (size === 1) {
    attr.setX(index, value)
  } else if (size === 2) {
    attr.setXY(index, value.x, value.y)
  } else if (size === 3) {
    if (value.isColor) {
      attr.setXYZ(index, value.r, value.g, value.b)
    } else {
      attr.setXYZ(index, value.x, value.y, value.z)
    }
  } else if (size === 4) {
    attr.setXYZW(index, value.x, value.y, value.z, value.w)
  } else if (value.toArray) {
    value.toArray(attr.array, index * size)
  } else {
    attr.set(value, index * size)
  }
}

function getDefaultUniformValue (material, name) {
  // Try uniforms on the material itself, then try the builtin material shaders
  let uniforms = material.uniforms
  if (uniforms && uniforms[name]) {
    return uniforms[name].value
  }
  uniforms = getShadersForMaterial(material).uniforms
  if (uniforms && uniforms[name]) {
    return uniforms[name].value
  }
  return null
}

function getItemSizeForValue (value) {
  return value == null ? 0
    : typeof value === 'number' ? 1
    : value.isVector2 ? 2
    : value.isVector3 || value.isColor ? 3
    : value.isVector4 || value.isQuaternion ? 4
    : value.elements ? value.elements.length
    : Array.isArray(value) ? value.length
    : 0
}

