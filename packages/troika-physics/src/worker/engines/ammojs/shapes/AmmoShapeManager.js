/* eslint-env worker  */
'use strict'

importScripts('engines/ammojs/shapes/getAmmoShape.js')

class AmmoShapeManager {
  constructor () {
    this._shapeCache = Object.create(null)
  }

  getShape (shapeConfig) {
    // const { shape } = shapeConfig
    // if (!this._shapeCache[shape]) {
    //   this._shapeCache[shape] = self.getAmmoShape(shapeConfig)
    // }
    // return this._shapeCache[shape]
    return self.getAmmoShape(shapeConfig)
  }
  
  // objectRemoved () {

  // }
}

self.AmmoShapeManager = AmmoShapeManager
