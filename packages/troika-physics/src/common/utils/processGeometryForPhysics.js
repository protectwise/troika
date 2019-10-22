import { BufferGeometry } from 'three'
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils'

/* Source: https://github.com/mrdoob/three.js/blob/master/examples/webgl_physics_volume.html */

function isEqual (x1, y1, z1, x2, y2, z2) {
  var delta = 0.000001
  return Math.abs(x2 - x1) < delta &&
      Math.abs(y2 - y1) < delta &&
      Math.abs(z2 - z1) < delta
}

function mapIndices (bufGeometry, indexedBufferGeom) {
  // Creates $physicsVertices, $physicsIndices and $physicsIndexAssociation in bufGeometry
  var vertices = bufGeometry.attributes.position.array
  var idxVertices = indexedBufferGeom.attributes.position.array
  var indices = indexedBufferGeom.index.array
  var numIdxVertices = idxVertices.length / 3
  var numVertices = vertices.length / 3
  bufGeometry.$physicsVertices = idxVertices
  bufGeometry.$physicsIndices = indices
  bufGeometry.$physicsIndexAssociation = []
  for (var i = 0; i < numIdxVertices; i++) {
    var association = []
    bufGeometry.$physicsIndexAssociation.push(association)
    var i3 = i * 3
    for (var j = 0; j < numVertices; j++) {
      var j3 = j * 3
      if (isEqual(idxVertices[i3], idxVertices[i3 + 1], idxVertices[i3 + 2],
        vertices[j3], vertices[j3 + 1], vertices[j3 + 2])) {
        association.push(j3)
      }
    }
  }
}

/**
 * Process a Geometry's Vertices and Normals to prepare them to be driven by a Collision Body in
 * the PhysicsWorld
 *
 * @export
 * @param {THREE.BufferGeometry} bufGeometry ThreeJS BufferGeometry (or derivative) to be processed.
 */
export default function processGeometry (bufGeometry) {
  // Ony consider the position values when merging the vertices
  var posOnlyBufGeometry = new BufferGeometry()
  posOnlyBufGeometry.addAttribute('position', bufGeometry.getAttribute('position'))
  posOnlyBufGeometry.setIndex(bufGeometry.getIndex())
  // Merge the vertices so the triangle soup is converted to indexed triangles
  var indexedBufferGeom = BufferGeometryUtils.mergeVertices(posOnlyBufGeometry)
  // Create index arrays mapping the indexed vertices to bufGeometry vertices
  mapIndices(bufGeometry, indexedBufferGeom)
}
