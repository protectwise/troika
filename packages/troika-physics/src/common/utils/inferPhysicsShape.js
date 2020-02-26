import { Vector3, BufferGeometry } from 'three'
import processGeometry from './processGeometryForPhysics'
import { CSG } from '@hi-level/three-csg'
import CONSTANTS from '../constants'

function getThreeObject (facade) {
  if (facade.instancedThreeObject) {
    return facade.instancedThreeObject
  } else if (facade.threeObject) {
    return facade.threeObject
  }
}

function inferRigidBodyShape (geometry, threeObject) {
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
    case 'CylinderBufferGeometry':
    case 'CylinderGeometry':
      return {
        shape: 'cylinder',
        args: [{
          method: 'Vector3',
          args: [
            parameters.radiusTop,
            parameters.height / 2, // Half-extents
            parameters.radiusTop
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
    case 'Geometry':
    case 'BufferGeometry':
      return {
        shape: 'convex-hull', // Fallback to implicit convex hull.
        args: [
          getWorldVertices(geometry, threeObject)
        ]
      }
    default:
      console.warn(`Unable to infer physics shape for type "${type}", falling back to convex hull.`)
      // Fallback to convex hull. Note that this will "cover" any concave portions of a mesh,
      // possibly resulting in a less than desirable collision shape.
      return {
        shape: 'convex-hull',
        args: [
          getWorldVertices(geometry, threeObject)
        ]
      }
  }
}

function getWorldVertices (geometry, threeObject) {
  if (!geometry.isBufferGeometry) {
    geometry = new BufferGeometry().fromGeometry(geometry)
  }
  processGeometry(geometry)

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
    vertices: verts, // Float32Array
    indices: geometry.$physicsIndices, // Uint16Array
    numTris: geometry.$physicsIndices.length / 3
    // associations: geometry.$physicsIndexAssociation
  }
}

function unifyChildGeometries (groupFacade, threeObject) {
  let combinedBSP
  const outputMatrix = threeObject.matrixWorld

  for (let i = 0, numChildren = groupFacade._orderedChildKeys.length; i < numChildren; i++) {
    const childKey = groupFacade._orderedChildKeys[i]
    const child = groupFacade._childrenDict[childKey]
    let childBSP = null

    if (child.instancedThreeObject) {
      const origMatrix = child.instancedThreeObject.matrix
      const origMatrixWorld = child.instancedThreeObject.matrixWorld
      child.instancedThreeObject.matrix = child.threeObject.matrix
      child.instancedThreeObject.matrixWorld = child.threeObject.matrixWorld
      childBSP = CSG.fromMesh(child.instancedThreeObject)
      child.instancedThreeObject.matrixWorld = origMatrix
      child.instancedThreeObject.matrixWorld = origMatrixWorld
    } else {
      childBSP = CSG.fromMesh(child.threeObject)
    }

    if (!combinedBSP) {
      combinedBSP = childBSP
      // outputMatrix = child.matrixWorld // Result object will use the transformation matrix of the first child
    } else {
      combinedBSP = combinedBSP.union(childBSP)
    }
  }

  const outputMesh = CSG.toMesh(combinedBSP, outputMatrix)

  return getWorldVertices(outputMesh.geometry, threeObject)
}

const DEFAULT_COMPOUND_CHILD_MASS = 1

function inferPhysicsGroup (facade, threeObject) {
  if (facade.physics && facade.physics.isStatic) {
    // Static groups perform better as a merged btBvhTriangleMeshShape instead of a compound collision shape
    const combinedGeometry = unifyChildGeometries(facade, threeObject)

    return {
      shape: 'bvh-tri-mesh',
      args: [combinedGeometry]
    }
  } else {
    // TODO determine best guess between combined-geometry btGimpactShape (which supports dynamics), or a Compound Shape
    const USE_COMPOUND_SHAPE = true

    if (USE_COMPOUND_SHAPE) {
      // Construct a CompoundShape collider by inferring all of this Group's child shapes.
      const args = threeObject.children.map(child => {
        if (child.scale.x !== 1 || child.scale.y !== 1 || child.scale.z !== 1) {
          console.warn('WARNING: Compound physics shapes do not work well with object scaling. You will likely notice undesired behavior.')
        }

        // const trans = new Vector3()
        // const rot = new Quaternion()
        // const scale = new Vector3()
        // child.matrixWorld.decompose(trans, rot, scale)
        // const zeroScale = new Vector3(0, 0, 0)
        // const t = new Matrix4().compose(trans, rot, zeroScale)

        return [
          inferPhysicsShape(child.$facade),
          [child.position.x, child.position.y, child.position.z],
          [child.quaternion.x, child.quaternion.y, child.quaternion.z, child.quaternion.w],
          [child.scale.x, child.scale.y, child.scale.z],
          (child.physics && child.physics.mass) || DEFAULT_COMPOUND_CHILD_MASS
        ]
      })

      return {
        shape: 'compound',
        args: args
      }
    } else {
      // TODO Ammo/bullet gImpactShape from combined geometries
      return {
        shape: 'combined-geometry'
      }
    }
  }
}

export function inferPhysicsShape (facade) {
  const threeObject = getThreeObject(facade)

  if (threeObject.type === 'Group') {
    return inferPhysicsGroup(facade, threeObject)
  }

  const geometry = threeObject.geometry

  if (facade.physics && facade.physics.isSoftBody) {
    if (!geometry.isBufferGeometry) {
      console.error('troika-physics soft volumes only support threeJS BufferGeometry instances')
      return { vertices: [], indices: [], numTris: 0 }
    }
    const isRope = threeObject.type === 'LineSegments' || threeObject.type === 'Line'
    if (isRope) {
      facade.physics.softBodyType = CONSTANTS.SOFT_BODY_TYPE.ROPE
    }
    return getWorldVertices(geometry, threeObject)
  } else {
    return inferRigidBodyShape(geometry, threeObject)
  }
}
