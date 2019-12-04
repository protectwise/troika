import {Group3DFacade, Scene3DFacade} from 'troika-3d'
import { Matrix4, Vector3 } from 'three'

const raycastFrequency = 16
const tempMat4 = new Matrix4()
const mouseEvents = ['mousemove', 'mouseover', 'click']


/**
 * Base class for all VR controllers.
 */
export default class VrController extends Group3DFacade {

  constructor(parent) {
    super(parent)

    // Listen to mousemove events at the scene level, so we can respond to intersection changes
    const onMouseEvent = this._onSceneMouseEvent = this._onSceneMouseEvent.bind(this)
    const scene = this._findScene()
    if (scene) {
      mouseEvents.forEach(type => {
        scene.addEventListener(type, onMouseEvent)
      })
    }
  }

  _findScene() {
    let facade = this
    while (facade) {
      if (facade instanceof Scene3DFacade) {
        return facade
      }
      facade = facade.parent
    }
  }

  afterUpdate() {
    // If it has a pointer ray, trigger a raycast
    const now = Date.now()
    if (now - (this._lastRaycast || 0) > raycastFrequency) {
      this.updateMatrices()
      const ray = this.getPointerRay() //may be null
      if (ray) {
        this.notifyWorld('rayPointerMotion', ray)
      }
      this._lastRaycast = now
    }

    super.afterUpdate()
  }

  /**
   * @abstract
   * May be implemented to return a worldspace Ray indicating where this controller is
   * currently pointing, if it has pointing capability.
   * @return {Ray|null}
   */
  getPointerRay() {
    return null
  }

  /**
   * @abstract
   * Handler invoked after every raycast of this controller's pointer ray, if it has one. Will be passed
   * the synthetic 'mousemove' event that triggered the raycast, which will hold the usual raycast result
   * info (`target` facade, `intersection` data, etc.), and also a `localPoint` vector which will hold
   * the position of the intersection pre-translated to this controller's local space, if there was an
   * intersection.
   *
   * Subclasses may implement this to update their visual representation or otherwise respond to raycast
   * changes, e.g. updating a cursor position or a laser pointer length, or to start/end a fuse timer.
   *
   * @param {Object<{event:SyntheticEvent,localPoint:Vector3|null,hapticPulse:Object<{value:number,duration:number}>}>} intersectionInfo
   */
  onPointerRayIntersectionChange(intersectionInfo) {
    // abstract
  }

  _onSceneMouseEvent(e) {
    if (e.nativeEvent.eventSource === this) {
      // Find point of intersection in local coordinates
      let localPoint = null
      const worldPoint = e.intersection && e.intersection.point
      if (worldPoint) {
        localPoint = worldPoint.clone().applyMatrix4(tempMat4.getInverse(this.threeObject.matrixWorld))
      }
      const isScene = e.target === e.currentTarget
      this.onPointerRayIntersectionChange({
        event: e,
        localPoint,
        hapticPulse: (e.type === 'mouseover' && !isScene) ? {value: 0.3, duration: 10}
          : e.type === 'click' ? {value: 1, duration: 20}
          : null
      })
    }
  }

  destructor() {
    const scene = this._findScene()
    if (scene) {
      mouseEvents.forEach(type => {
        scene.removeEventListener(type, this._onSceneMouseEvent)
      })
    }
    super.destructor()
  }

}

