import {Ray} from 'three'
import VrController from './VrControllerFacade'

export default class GazeVrController extends VrController {

  getPointerRay() {
    // return ray from camera
    const camera = this.getCameraFacade()
    camera.updateMatrices() //TODO needed?
    const camMatrix = camera.threeObject.matrixWorld

    const ray = this._pointerRay || (this._pointerRay = new Ray())
    ray.origin.setFromMatrixPosition(camMatrix)
    ray.direction.set(0, 0, -1).transformDirection(camMatrix)
    return ray
  }

}
