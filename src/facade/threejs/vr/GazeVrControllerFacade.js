import {Ray} from 'three'
import VrController from './VrControllerFacade'
import CursorFacade from './CursorFacade'

const FUSE_TIME = 1500


/**
 * A VR controller that follows the center gaze of the headset pose, as a fallback for when
 * there are no hand controllers available.
 *
 * A cursor is shown at the point the gaze intersects any pointable objects. Pointer over/out/move
 * events are fired as expected, and click events are fired if the user holds the gaze
 * cursor on an object for a period of time.
 *
 * Other events such as wheel or drag events are not currently supported.
 */
export default class GazeVrController extends VrController {

  constructor(parent) {
    super(parent)
    this._gazeTarget = null
    this._fuseStart = null

    // Create gaze cursor
    this.children = [
      this.cursorChildDef = {
        key: 'cursor',
        facade: CursorFacade
      }
    ]
  }

  afterUpdate() {
    // Sync the gaze controller's world matrix to that of the VR camera with pose applied
    const cam = this.getCameraFacade()
    this.threeObject.matrixWorld.copy(cam.threeObject.matrixWorld)
    this._worldMatrixVersion = cam._worldMatrixVersion

    super.afterUpdate()
  }

  getPointerRay() {
    const ray = this._pointerRay || (this._pointerRay = new Ray())
    const matrix = this.threeObject.matrixWorld
    ray.origin.setFromMatrixPosition(matrix)
    ray.direction.set(0, 0, -1).transformDirection(matrix)
    return ray
  }

  /**
   * @override
   */
  onPointerRayIntersectionChange(intersectionInfo) {
    const {event, localPoint} = intersectionInfo

    // Update cursor
    const cursor = this.cursorChildDef
    if (localPoint) {
      cursor.z = -localPoint.length()
    } else {
      cursor.z = -1
    }

    // Track current gaze target and start/cancel fuse when changing
    let target = event.target
    if (target !== this._gazeTarget) {
      this._gazeTarget = target
      this._fuseStart = target ? Date.now() : null
    } else if (target && this._fuseStart !== null && (Date.now() - this._fuseStart > FUSE_TIME)) {
      this._fuseStart = null
      const ray = this.getPointerRay()
      ;['mousedown', 'mouseup', 'click'].forEach(type => {
        this.notifyWorld('rayPointerAction', {type, ray})
      })
    }

    super.onPointerRayIntersectionChange(intersectionInfo)
  }

}
