import { ThenableWorkerModule } from 'troika-worker-utils'
import * as ammoLoader from '../../../../libs/troika-ammo.wasm.js'
import getAmmoShapeManager from './AmmoShapeManager'
import getAmmoUtils from './AmmoUtils'
import ammoConstants from './ammoConstants'
import getAmmoPhysicsEngine from './AmmoPhysicsEngine'

export const WORKER_ID = 'physics-worker-ammo'

// Source: https://stackoverflow.com/a/47880734
const supportsWasm = () => {
  /* eslint-env worker, browser */
  try {
    if (typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function') {
      const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00))
      if (module instanceof WebAssembly.Module) {
        return new WebAssembly.Instance(module) instanceof WebAssembly.Instance
      }
    }
  } catch (e) {
  }
  return false
}

export const physicsWorldAmmoModule = {
  dependencies: [
    ThenableWorkerModule,
    supportsWasm,
    ammoLoader,
    ammoConstants,
    getAmmoUtils,
    getAmmoPhysicsEngine,
    getAmmoShapeManager
  ],
  init (Thenable, _supportsWasm, getAmmo, CONSTANTS, _getAmmoUtils, _getAmmoPhysicsEngine, _getAmmoShapeManager) {
    /* eslint-env worker */
    let physicsWorld = null

    self._scriptDir = 'noop' // make Ammo.js loader happy

    return function (callArgs) {
      const response = new Thenable()

      if (!physicsWorld) {
        getAmmo().then(Ammo => {
          const AmmoUtils = _getAmmoUtils(Ammo, CONSTANTS)
          const utils = new AmmoUtils()
          const AmmoShapeManager = _getAmmoShapeManager(Ammo, utils)
          const shapeManager = new AmmoShapeManager()
          const AmmoPhysicsEngine = _getAmmoPhysicsEngine(Thenable, Ammo, CONSTANTS, utils, shapeManager)

          physicsWorld = new AmmoPhysicsEngine()

          response.resolve({ ready: true })
        })
      } else {
        physicsWorld.update(callArgs, result => {
          response.resolve(result)
        })
      }
      return response
    }
  },
  workerId: WORKER_ID
}
