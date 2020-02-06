import { ThenableWorkerModule } from 'troika-worker-utils'
import ammoLoader from '../../../../libs/troika-ammo.wasm.js'
import getAmmoShapeManager from './AmmoShapeManager'
import getAmmoUtils from './AmmoUtils'
import CONSTANTS from '../constants'
import getAmmoPhysicsEngine from './AmmoPhysicsEngine'
import getAmmoDebugDrawer from './AmmoDebugDrawer'

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
    CONSTANTS,
    getAmmoUtils,
    getAmmoPhysicsEngine,
    getAmmoShapeManager,
    getAmmoDebugDrawer
  ],
  init (Thenable, _supportsWasm, getAmmo, _CONSTANTS, _getAmmoUtils, _getAmmoPhysicsEngine, _getAmmoShapeManager, _getAmmoDebugDrawer) {
    /* eslint-env worker */
    let physicsWorld = null

    self._scriptDir = 'noop' // make Ammo.js loader happy

    return function (callArgs) {
      const response = new Thenable()

      if (!physicsWorld) {
        getAmmo().then(Ammo => {
          const AmmoUtils = _getAmmoUtils(Ammo, _CONSTANTS)
          const utils = new AmmoUtils()
          const AmmoShapeManager = _getAmmoShapeManager(Ammo, utils)
          const shapeManager = new AmmoShapeManager()
          const AmmoDebugDrawer = _getAmmoDebugDrawer(Thenable, Ammo, _CONSTANTS)
          const AmmoPhysicsEngine = _getAmmoPhysicsEngine(Thenable, Ammo, _CONSTANTS, utils, shapeManager, AmmoDebugDrawer)

          console.log(`~~ init ~~~~~`,callArgs )
          
          physicsWorld = new AmmoPhysicsEngine({
            enableDebugger: callArgs.enableDebugger
          })

          self.addEventListener('message', physicsWorld.receiveMessage.bind(physicsWorld))

          response.resolve({ physicsReady: true })
        })
      } else {
        console.error('PhysicsWorldAmmo already initialized')
        // physicsWorld.update(callArgs, result => {
        //   response.resolve(result)
        // })
      }
      return response
    }
  },
  workerId: WORKER_ID
}
