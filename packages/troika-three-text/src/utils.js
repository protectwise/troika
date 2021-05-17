import { InstancedBufferAttribute } from 'three'

/**
 * Utility for making URLs absolute
 */
export function toAbsoluteURL(path) {
  if (!toAbsoluteURL.el) {
    toAbsoluteURL.el = typeof document === 'undefined' ? {} : document.createElement('a')
  }
  toAbsoluteURL.el.href = path
  return toAbsoluteURL.el.href
}

/**
 * Local assign impl so we don't have to import troika-core
 */
export function assign(toObj, fromObj) {
  for (let key in fromObj) {
    if (fromObj.hasOwnProperty(key)) {
      toObj[key] = fromObj[key]
    }
  }
  return toObj
}

/**
 * Update an InstancedBufferAttribute to a new array of values, handling differences
 * between threejs versions.
 */
export function updateInstancedBufferAttribute(geom, attrName, typedArray, itemSize) {
  const attr = geom.getAttribute(attrName)
  if (typedArray) {
    // If length isn't changing, just update the attribute's array data
    if (attr && attr.array.length === typedArray.length) {
      attr.array.set(typedArray)
      attr.needsUpdate = true
    } else {
      geom.setAttribute(attrName, new InstancedBufferAttribute(typedArray, itemSize))
      // If the new attribute has a different size, we also have to (as of r117) manually clear the
      // internal cached max instance count. See https://github.com/mrdoob/three.js/issues/19706
      // It's unclear if this is a threejs bug or a truly unsupported scenario; discussion in
      // that ticket is ambiguous as to whether replacing a BufferAttribute with one of a
      // different size is supported, but https://github.com/mrdoob/three.js/pull/17418 strongly
      // implies it should be supported.
      delete geom._maxInstanceCount //for r117+, could be fragile
      geom.dispose() //for r118+, more robust feeling, but more heavy-handed than I'd like
    }
  } else if (attr) {
    geom.deleteAttribute(attrName)
  }
}

/**
 * Sets the instanceCount on an InstancedBufferGeometry.
 * Handles the maxInstancedCount -> instanceCount rename that happened in three r117.
 */
export function setInstanceCount(geom, count) {
  geom[geom.hasOwnProperty('instanceCount') ? 'instanceCount' : 'maxInstancedCount'] = count
}

