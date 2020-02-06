/* eslint-env browser */
import { defineWorkerModule, getWorker, terminateWorkerById } from 'troika-worker-utils'
import PhysicsManagerBase from '../../common/facade/PhysicsManagerBase'
import { physicsWorldAmmoModule, WORKER_ID } from './worker/PhysicsWorldAmmo.worker.js'
import CONSTANTS from '../../engines/ammo/constants'

let workerId = 1

const {
  MSG_HDR_SZ,
  MSG_TYPES,
  MSG_ITEM_SIZES,
  DEBUG_MSG,
  DEBUG_MAX_BUFFER_SIZE
} = CONSTANTS

const ENABLE_DEBUGGER = Boolean(process.env.NODE_ENV === 'development' || localStorage.getItem('troika-physics:forceDebugEnabled'))

export class PhysicsManagerAmmo extends PhysicsManagerBase {
  initPhysics () {
    if (!this.physicsWorkerModule) {
      // Define worker module on-demand to support multiple PhysicsManagers in a scene
      this.workerId = `${WORKER_ID}-${workerId++}`

      const initPhysicsWorkerModule = defineWorkerModule(Object.assign(
        {},
        physicsWorldAmmoModule,
        { workerId: this.workerId }
      ))

      const worker = getWorker(this.workerId)

      this.updatePhysicsWorld = (deltaTime, updateChangeset) => {
        worker.postMessage({
          method: 'updatePhysicsWorld',
          args: [deltaTime, updateChangeset]
        })
      }

      this.updateDebugOptions = (debugOptions) => {
        worker.postMessage({
          method: 'updateDebugOptions',
          args: [debugOptions]
        })
      }

      const _returnTransferable = payload => {
        if (!payload.buffer) {
          throw new Error('PhysicsManager: _returnTransferable is only for Transferable Typed Arrays')
        }
        if (payload.buffer.byteLength === 0) {
          // throw new Error('PhysicsManager: Transferable Array has zero byte length')
          console.warn('PhysicsManagerAmmo: Transferable array has zero byte length, it may still be in-use in the worker thread.')
          return
        }
        worker.postMessage(payload.buffer, [payload.buffer])
      }

      // Wrap the WorkerManager event handler so we can directly access messages
      const _oldOnmessage = worker.onmessage
      worker.onmessage = e => {
        let { data } = e
        let _isPhysicsMessage = false

        // byteLength === 1 is the worker making a SUPPORT_TRANSFERABLE test
        if (data instanceof ArrayBuffer && data.byteLength !== 1) {
          data = new Float32Array(data)
        }

        if (data instanceof Float32Array) {
          _isPhysicsMessage = true // Assume no WorkerModule getTransferable usage

          // console.log(`~~ received transferable!`, data.length)
          switch (data[0]) {
            case MSG_TYPES.RIGID_OUTPUT:
              this.handleRigidBodiesUpdate(data, data[1], MSG_HDR_SZ, MSG_ITEM_SIZES.RIGID)
              _returnTransferable(data)
              break
            case MSG_TYPES.DEBUG_OUTPUT: {
              const needsUpdate = Boolean(data[MSG_HDR_SZ + DEBUG_MSG.NEEDS_UPDATE])
              const drawOnTop = Boolean(data[MSG_HDR_SZ + DEBUG_MSG.DRAW_ON_TOP])
              const startIndex = data[MSG_HDR_SZ + DEBUG_MSG.GEOM_DRAW_RANGE_IDX_START]
              const endIndex = data[MSG_HDR_SZ + DEBUG_MSG.GEOM_DRAW_RANGE_IDX_END]
              const positionOffset = MSG_HDR_SZ + DEBUG_MSG.POSITIONS_BASE
              const colorOffset = MSG_HDR_SZ + DEBUG_MSG.COLORS_BASE
              
              if (needsUpdate) {
                this.handleDebugUpdate(data, drawOnTop, startIndex, endIndex, positionOffset, colorOffset)
              }
              _returnTransferable(data)
              break
            }
            default:
              console.warn(`Unrecognized transferrable message type: ${data[0]}`)
              break
          }
        }
        else if (data._physicsMsg) {
          console.log('~~ got other physics message')
          _isPhysicsMessage = true // Assume no WorkerModule gatTransferable usage
        }

        if (_isPhysicsMessage) {
          // this.receive(data)

          return
        }

        // Fallthrough to Troika WorkerModule
        _oldOnmessage.call(worker, e)
      }

      return initPhysicsWorkerModule({
        enableDebugger: ENABLE_DEBUGGER
      })
    } else {
      console.warn('PhysicsManagerAmmo: init called but there is a PhysicsWorker already running')
      return Promise.resolve({ physicsReady: true })
    }

    // this.initPhysicsWorkerModule().then(this.receive)
  }


  destructor () {
    // Since PhysicsManager is a user-specified
    // module we should clean up the worker when it is destroyed.
    terminateWorkerById(this.workerId)
    delete this.physicsWorkerModule
    super.destructor()
  }
}
