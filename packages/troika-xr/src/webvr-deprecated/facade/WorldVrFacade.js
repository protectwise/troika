import {World3DFacade} from 'troika-3d'
import {setAnimationScheduler} from 'troika-animation'
import {extendAsVrCamera} from './VrCamera'
import {VrControllerManager} from './VrControllerManager'

const emptyArray = []



class WorldVrFacade extends World3DFacade {

  afterUpdate() {
    // Disable pointer events on the onscreen canvas when in VR
    const vrDisplay = this._isInVR() ? this.vrDisplay : null
    this._togglePointerListeners(!vrDisplay)

    // Update the animation scheduler
    if (vrDisplay !== this._lastVrDisplay) {
      this._lastVrDisplay = vrDisplay
      this.renderingScheduler = vrDisplay || window
      setAnimationScheduler(vrDisplay || window)
    }

    super.afterUpdate()
  }

  doRender() {
    super.doRender()

    // Submit frame to the VR device
    if (this._isInVR()) {
      this.vrDisplay.submitFrame()
    }
  }

  _isInVR() {
    return !!(this.vrDisplay && this.vrDisplay.isPresenting)
  }

  /**
   * @override to wrap the configured camera with VR camera support
   */
  _getCameraDef() {
    const camera = super._getCameraDef()
    const vrDisplay = this._isInVR() ? this.vrDisplay : null
    if (vrDisplay) {
      camera.facade = extendAsVrCamera(camera.facade)
      camera.vrDisplay = vrDisplay
    }
    return camera
  }

  /**
   * @override to add VR controllers manager object
   */
  _getSceneDef() {
    const scene = super._getSceneDef()
    const vrDisplay = this._isInVR() ? this.vrDisplay : null
    if (vrDisplay) {
      scene.objects = emptyArray.concat(scene.objects, {
        key: 'vrcontrollers',
        facade: VrControllerManager,
        vrDisplay: vrDisplay
      })
    }
    return scene
  }

  /**
   * @override to size the rendering buffer based on the active VR display
   */
  _updateDrawingBufferSize(width, height, pixelRatio) {
    const vrDisplay = this._isInVR() ? this.vrDisplay : null
    if (vrDisplay) {
      const leftEye = vrDisplay.getEyeParameters('left')
      const rightEye = vrDisplay.getEyeParameters('right')
      width = Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2
      height = Math.max(leftEye.renderHeight, rightEye.renderHeight)
      pixelRatio = 1
    }
    super._updateDrawingBufferSize(width, height, pixelRatio)
  }

  /**
   * @override to always continuously render when in VR mode
   */
  _isContinuousRender() {
    return this._isInVR() || this.continuousRender
  }

  /**
   * @override to skip rendering HTML overlays when in VR mode
   */
  _doRenderHtmlItems() {
    if (this._isInVR()) {
      if (this.renderHtmlItems) {
        this.renderHtmlItems(emptyArray)
      }
    } else {
      super._doRenderHtmlItems()
    }
  }

}



export default WorldVrFacade
