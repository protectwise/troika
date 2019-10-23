/* eslint-env browser */
import { defineWorkerModule, terminateWorkerById } from 'troika-worker-utils'
import PhysicsManagerBase from '../../common/facade/PhysicsManagerBase'
import { physicsWorldAmmoModule, WORKER_ID } from './worker/PhysicsWorldAmmo.worker.js'

let workerId = 1

export class PhysicsManagerAmmo extends PhysicsManagerBase {
  updatePhysicsWorld (payload, callback) {
    if (!this.physicsWorkerModule) {
      // Define worker module on-demand to support multiple PhysicsManagers in a scene
      this.workerId = `${WORKER_ID}-${workerId++}`
      this.physicsWorkerModule = defineWorkerModule(Object.assign(
        {},
        physicsWorldAmmoModule,
        { workerId: this.workerId }
      ))
    }
    this.physicsWorkerModule(payload).then(callback)
  }

  destructor () {
    // Since PhysicsManager is a user-specified
    // module we should clean up the worker when it is destroyed.
    terminateWorkerById(this.workerId)
    delete this.physicsWorkerModule
    super.destructor()
  }
}
