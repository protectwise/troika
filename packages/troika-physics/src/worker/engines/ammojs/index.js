/* eslint-env worker */
'use strict'

/**
 * Main abstraction wrapper for the Ammo.js physics engine.
 * Other engines should use this interface as a model for
 * their own abstractions.
 */

importScripts('engines/ammojs/loadAmmo.js') // Exposes global "Ammo" loaded promise
importScripts('engines/ammojs/constants.js')

self.Ammo().then(function (Ammo) {
  self.Ammo = Ammo // Expose to global scope

  importScripts('engines/ammojs/ammoUtils.js')
  importScripts('engines/ammojs/shapes/AmmoShapeManager.js')
  importScripts('engines/ammojs/AmmoPhysicsEngine.js')

  self.ammoShapeManager = new self.AmmoShapeManager()

  self.physicsEngine = new self.AmmoPhysicsEngine()
  console.log('~~ CREATING ammo physics engine', self.physicsEngine)
  postMessage({ type: 'ready' })
})
