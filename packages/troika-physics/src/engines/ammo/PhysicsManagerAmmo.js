/* eslint-env browser */
import { defineWorkerModule, getWorker, terminateWorkerById } from 'troika-worker-utils'
import PhysicsManagerBase from '../../common/facade/PhysicsManagerBase'
import { physicsWorldAmmoModule, WORKER_ID } from './worker/PhysicsWorldAmmo.worker.js'
import CONSTANTS from '../../common/constants'

let workerId = 1

const {
  MSG_TYPES
} = CONSTANTS

const ENABLE_DEBUGGER = Boolean(process.env.NODE_ENV === 'development' || localStorage.getItem('troika-physics:forceDebugEnabled'))

export class PhysicsManagerAmmo extends PhysicsManagerBase {
  initPhysics () {
    if (!this.physicsWorkerModule) {
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
          console.warn('PhysicsManagerAmmo: Transferable array has zero byte length, it may still be in-use in the worker thread.')
          return
        }
        worker.postMessage(payload.buffer, [payload.buffer])
      }

      const _oldOnMessageHandler = worker.onmessage

      worker.onmessage = e => {
        let { data } = e
        let _messageHandled = false

        // byteLength === 1 is the worker making a SUPPORT_TRANSFERABLE test
        if (data instanceof ArrayBuffer && data.byteLength !== 1) {
          data = new Float32Array(data)
        }

        if (data instanceof Float32Array) {
          _messageHandled = true

          switch (data[0]) {
            case MSG_TYPES.RIGID_OUTPUT:
              this.handleRigidBodiesUpdate(data, data[1])
              _returnTransferable(data)
              break
            case MSG_TYPES.SOFT_OUTPUT:
              this.handleSoftBodiesUpdate(data, data[1])
              _returnTransferable(data)
              break
            case MSG_TYPES.DEBUG_OUTPUT: {
              this.handleDebugUpdate(data)
              _returnTransferable(data)
              break
            }
            case MSG_TYPES.COLLISION_OUTPUT:
              this.handleCollisionsUpdate(data, data[1])
              _returnTransferable(data)
              break
            default:
              console.warn(`Unrecognized transferrable message type: ${data[0]}`)
              break
          }
        }

        if (_messageHandled) {
          // If we handled the message, do not allow it to propagate to WorkerModule
          return
        }

        _oldOnMessageHandler.call(worker, e)
      }

      return initPhysicsWorkerModule({
        enableDebugger: ENABLE_DEBUGGER
      })
    } else {
      console.warn('PhysicsManagerAmmo: init called but there is a PhysicsWorker already running')
      return Promise.resolve({ physicsReady: true })
    }
  }

  destructor () {
    terminateWorkerById(this.workerId)
    delete this.physicsWorkerModule
    super.destructor()
  }
}
