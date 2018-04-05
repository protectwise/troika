import Group3DFacade from '../Group3DFacade'

const raycastFrequency = 50


export default class VrController extends Group3DFacade {

  constructor(parent) {
    super(parent)
    this.onBeforeRender = this.onBeforeRender.bind(this)
  }

  onBeforeRender(renderer, scene, camera) {
    // If it has a pointer ray, trigger a raycast
    // TODO verify onBeforeRender is the right time to do this???
    const now = Date.now()
    if (now - (this._lastRaycast || 0) > raycastFrequency) {
      const ray = this.getPointerRay() //may be null
      if (ray) {
        this.notifyWorld('pointerRayMotion', ray)
      }
      this._lastRaycast = now
    }
  }

  getPointerRay() {
    return null
  }

}

