import { Vector3 } from 'three'
import processGeometry from './processGeometryForPhysics'

function getThreeObject (facade) {
  if (facade.instancedThreeObject) {
    return facade.instancedThreeObject
  } else if (facade.threeObject) {
    return facade.threeObject
  }
}

function inferRigidBodyShape (geometry) {
  const {
    type,
    parameters
  } = geometry

  switch (type) {
    case 'SphereBufferGeometry':
    case 'SphereGeometry':
      return {
        shape: 'sphere',
        args: [parameters.radius || 1]
      }
    case 'BoxBufferGeometry':
    case 'BoxGeometry':
      return {
        shape: 'box',
        args: [{
          method: 'Vector3',
          args: [
            parameters.width / 2,
            parameters.height / 2,
            parameters.depth / 2
          ]
        }]
      }
    // TODO collider for non-infinite threeJS planes -- box2dShape?
    // case 'PlaneGeometry':
    // case 'PlaneBufferGeometry':
    //   return {
    //     shape: 'plane',
    //     args: [{
    //       method: 'Vector3',
    //       args: [
    //         parameters.width / 2,
    //         parameters.height / 2,
    //       ]
    //     }]
    //   }
    default:
      throw new Error(`Unable to infer physics shape from geometry type:"${type}"`)
  }
}

function inferSoftVolumeShape (geometry, threeObject) {
  processGeometry(geometry)

  // threeObject.updateMatrixWorld()
  const sharedVec = new Vector3()

  const verts = geometry.$physicsVertices

  // Apply world transformation to all vertices
  for (let i = 0; i < verts.length; i += 3) {
    const x = verts[i + 0]
    const y = verts[i + 1]
    const z = verts[i + 2]

    sharedVec.set(x, y, z)
    threeObject.localToWorld(sharedVec) // Translate local-space coords to world for physicsWorld

    verts[i + 0] = sharedVec.x
    verts[i + 1] = sharedVec.y
    verts[i + 2] = sharedVec.z
  }

  return {
    volumeVertices: verts, // Float32Array
    volumeIndices: geometry.$physicsIndices // Uint16Array
    // numNodes: geometry.$physicsIndexAssociation.length
  }
}

export function inferPhysicsShape (facade) {
  const threeObject = getThreeObject(facade)
  const geometry = threeObject.geometry

  if (facade.physics.isSoftBody) {
    if (!geometry.isBufferGeometry) {
      console.error('troika-physics soft volumes only support threeJS BufferGeometry instances')
      return { volumeVertices: [], volumeIndices: [] }
    }
    return inferSoftVolumeShape(geometry, threeObject)
  } else {
    return inferRigidBodyShape(geometry)
  }
}
