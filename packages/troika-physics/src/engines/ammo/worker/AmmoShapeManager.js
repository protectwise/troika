/* eslint-env worker */
/* eslint-disable new-cap */

export default function getAmmoShapeManager (Ammo, utils) {
  return class AmmoShapeManager {
    constructor () {
      this._shapeCache = Object.create(null)
    }

    _getAmmoShape (shapeConfig) {
      const { shape, args = [], shapeActions = [] } = shapeConfig
      const constructorArgs = utils.recurComposeArgs(args)
      let ammoShape

      // NOTE re: caching/sharing https://pybullet.org/Bullet/BulletFull/classbtRigidBody.html
      // > It is recommended for performance and memory use to share btCollisionShape objects whenever possible.
      // NOTE: shape localScaling gets applied to all shapes when sharing objects.

      switch (shape) {
        case 'sphere': {
          ammoShape = new Ammo.btSphereShape(...constructorArgs)
          break
        }
        case 'box': {
          ammoShape = new Ammo.btBoxShape(...constructorArgs)
          break
        }
        default:
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
