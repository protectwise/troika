import { Facade, World3DFacade } from 'troika-3d'
import {extendAsXrCamera} from './XrCamera'
import {XrInputSourceManager} from 'src/troika/packages/troika-xr/src/facade/webxr-wip/XrInputSourceManager.js'

const emptyArray = []



class WorldXrFacade extends World3DFacade {
  /**
   * Relevant things passed in from XrAware:
   * @property {XRSession} xrSession
   * @property {XRSessionMode} xrSessionMode
   * @property {XRReferenceSpace} xrReferenceSpace
   * @property {XRReferenceSpaceType} xrReferenceSpaceType
   */

  afterUpdate() {
    // Disable pointer events on the onscreen canvas when in an immersive XR session
    this._togglePointerListeners(!this._isImmersive())
    super.afterUpdate()
  }

  /**
   * @override
   */
  doRender(timestamp, xrFrame) {
    const {xrSession, _threeRenderer:renderer} = this

    // Invoke xrFrame handlers
    if (xrSession && xrFrame) {
      this.eventRegistry.forEachListenerOfType('xrframe', fn => fn(xrFrame), this)
    }

    if (xrSession) {
      // Initialize XRWebGLLayer if needed
      let layer = this._webglLayer
      const context = renderer.getContext()
      if (!layer || layer._context !== context) {
        layer = this._webglLayer = new XRWebGLLayer(xrSession, context)
        layer._context = context
      }
    } else {
      renderer.setFramebuffer(null)
    }

    super.doRender()
  }

  _isOpaque() {
    return this.xrSession && this.xrSession.environmentBlendMode === 'opaque'
  }

  _isImmersive() {
    return this.xrSession && this.xrSessionMode !== 'inline'
  }

  /**
   * @override to wrap the configured camera with XR camera support
   */
  _getCameraDef() {
    const camera = super._getCameraDef()
    const {xrSession} = this
    if (xrSession) {
      camera.facade = extendAsXrCamera(camera.facade)
      camera.xrSession = xrSession
    }
    return camera
  }

  /**
   * @override to add VR controllers manager object
   */
  _getSceneDef() {
    const scene = super._getSceneDef()
    const {xrSession} = this
    if (xrSession) {
      scene.objects = emptyArray.concat(scene.objects, {
        key: 'xrInputMgr',
        facade: XrInputSourceManager,
        xrSession
      })
    }
    return scene
  }

  /**
   * @override to size the rendering buffer based on the active VR display
   */
  _updateDrawingBufferSize(width, height, pixelRatio) {
    const {xrSession} = this
    if (xrSession) {


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
    return this.xrSession || this.continuousRender
  }

  /**
   * @override to use the XRSession's scheduler when appropriate
   */
  _requestRenderFrame(callback) {
    return (this.xrSession || window).requestAnimationFrame(callback)
  }

  /**
   * @override to use the XRSession's scheduler when appropriate
   */
  _cancelAnimationFrame(frameId) {
    return (this.xrSession || window).cancelAnimationFrame(frameId)
  }

  /**
   * @override to skip rendering HTML overlays when in immersive mode
   */
  _doRenderHtmlItems() {
    if (this._isImmersive()) {
      if (this.renderHtmlItems) {
        this.renderHtmlItems(emptyArray)
      }
    } else {
      super._doRenderHtmlItems()
    }
  }
}


export default WorldXrFacade
