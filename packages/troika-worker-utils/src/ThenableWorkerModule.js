import Thenable from './Thenable'
import {defineWorkerModule} from './WorkerModules'

/**
 * Just the {@link Thenable} function wrapped as a worker module. If another worker
 * module needs Thenable as a dependency, it's better to pass this module rather than
 * the raw function in its `dependencies` array so it only gets registered once.
 */
export default defineWorkerModule({
  dependencies: [Thenable],
  init: function(Thenable) {
    return Thenable
  }
})