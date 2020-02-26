/* eslint-env worker */
/* eslint-disable new-cap */

export default function getAmmoShapeManager (Ammo, utils) {
  return class AmmoShapeManager {
    constructor () {
      this._shapeCache = Object.create(null)
      this._trans = new Ammo.btTransform()
      this._trans.setIdentity()
    }

    _getAmmoShape (shapeConfig) {
      const { shape, args = [], shapeActions = [] } = shapeConfig
      const constructorArgs = shape === 'compound' ? null : utils.recurComposeArgs(args)
      let ammoShape

      // NOTE re: caching/sharing https://pybullet.org/Bullet/BulletFull/classbtRigidBody.html
      // > It is recommended for performance and memory use to share btCollisionShape objects whenever possible.
      // NOTE: shape localScaling gets applied to all shapes when sharing objects.

      switch (shape) {
        case 'bvh-tri-mesh': {
          const {
            vertices,
            indices,
            numTris,
            associations
          } = args[0]

          // console.log('~~ worker making bvh-tri-mesh', vertices, indices, numTris, associations)

          // TODO investigate using for btTriangleIndexVertexArray as an alternative to btTriangleMesh. Improved performance?
          const triMesh = new Ammo.btTriangleMesh()

          // // triMesh.preallocateVertices()
          for (let i = 0; i < indices.length; i += 3) {
            const va = indices[i + 0] * 3
            const vb = indices[i + 1] * 3
            const vc = indices[i + 2] * 3

            triMesh.addTriangle(
              new Ammo.btVector3(vertices[va + 0], vertices[va + 1], vertices[va + 2]),
              new Ammo.btVector3(vertices[vb + 0], vertices[vb + 1], vertices[vb + 2]),
              new Ammo.btVector3(vertices[vc + 0], vertices[vc + 1], vertices[vc + 2]),
              false // removeDuplicateVertices
            )
          }

          const useQuantizedAabbCompression = true
          ammoShape = new Ammo.btBvhTriangleMeshShape(triMesh, useQuantizedAabbCompression)

          // ammoShape = new Ammo.btEmptyShape()
          break
        }
        case 'combined-geometry': {
          console.error('TODO impl')
          break
        }
        case 'convex-hull': {
          const { vertices } = args[0]
          ammoShape = new Ammo.btConvexHullShape()

          for (let i = 0; i < vertices.length; i += 3) {
            ammoShape.addPoint(
              new Ammo.btVector3(vertices[i + 0], vertices[i + 1], vertices[i + 2]),
              true // recalculateLocalAabb
            )
          }

          // ammoShape.optimizeConvexHull()

          break
        }
        case 'compound': {
          const children = args

          ammoShape = new Ammo.btCompoundShape()

          this._trans.setIdentity() // Reset
          // this._trans.setOrigin(new Ammo.btVector3(0, 0, 0))
          const masses = []
          children.forEach(([shape, pos, quat, scale, mass], i) => {
            const childAmmoShape = this._getAmmoShape(shape)
            // this._trans.setFromOpenGLMatrix(transformMatrix) // Get local transform for shape at this index
            const _trans = new Ammo.btTransform()
            _trans.setIdentity()
            _trans.setOrigin(new Ammo.btVector3(pos[0], pos[1], pos[2]))
            _trans.setRotation(new Ammo.btQuaternion(quat[0], quat[1], quat[2], quat[3]))
            childAmmoShape.setLocalScaling(new Ammo.btVector3(scale[0], scale[1], scale[2]))
            ammoShape.addChildShape(_trans, childAmmoShape)
            // body.updateInertiaTensor()
            // this._trans.setIdentity() // Reset
            masses[i] = mass
          })

          // ammoShape.recomputeChildBounds()
          // const principal = new Ammo.btTransform()
          // const inertia = new Ammo.btVector3()
          // ammoShape.calculatePrincipalAxisTransform(masses, principal, inertia)
          break
        }
        case 'sphere': {
          ammoShape = new Ammo.btSphereShape(...constructorArgs)
          break
        }
        case 'box': {
          ammoShape = new Ammo.btBoxShape(...constructorArgs)
          break
        }
        case 'cylinder': {
          // Note that there are also btCylinderShapeX and btCylinderShapeZ options, for cylinders with a primary axis that matches. Default is Y
          ammoShape = new Ammo.btCylinderShape(...constructorArgs)
          break
        }
        default:
          // ammoShape = new Ammo.btEmptyShape()
          throw new Error(`Unsupported shape specified: ${shape}`)
      }

      /**
       * http://www.cs.kent.edu/~ruttan/GameEngines/lectures/Bullet_User_Manual
       * Collision Margin
       * Bullet uses a small collision margin for collision shapes, to improve performance and reliability of the
       * collision detection. It is best not to modify the default collision margin, and if you do use a positive
       * value: zero margin might introduce problems. By default this collision margin is set to 0.04, which is 4
       * centimeter if your units are in meters (recommended).
      */

      // ammoShape.setMargin(CONSTANTS.DEFAULT_MARGIN) // TODO allow config adjustments

      for (let aI = 0; aI < shapeActions.length; aI++) {
        const { method, args = [] } = shapeActions[aI]
        const composedActionArgs = utils.recurComposeArgs(args)
        ammoShape[method](...composedActionArgs)
      }

      return ammoShape
    }

    getShape (shapeConfig) {
      // const { shape } = shapeConfig
      // if (!this._shapeCache[shape]) {
      //   this._shapeCache[shape] = self.getAmmoShape(shapeConfig)
      // }
      // return this._shapeCache[shape]
      return this._getAmmoShape(shapeConfig)
    }

    // objectRemoved () {

    // }
  }
}
