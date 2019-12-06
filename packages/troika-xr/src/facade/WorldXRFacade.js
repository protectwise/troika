import { World3DFacade } from 'troika-3d'
import { setAnimationScheduler } from 'troika-animation'
import { XRInputSourceManager } from './XRInputSourceManager'
import { extendAsXRCamera } from './XRCameraFacade'
import { Vector2 } from 'three'

const emptyArray = []
const tempVec2 = new Vector2()

const _xrSessions = new WeakMap()


class WorldXRFacade extends World3DFacade {
  /**
   * Relevant things passed in from XRAware:
   * @property {XRSession} xrSession
   * @property {XRSessionMode} xrSessionMode
   * @property {XRReferenceSpace} xrReferenceSpace
   * @property {XRReferenceSpaceType} xrReferenceSpaceType
   *
   * New global event types:
   * `xrframe` - fired on each frame, with the current time and XRFrame object as arguments
   */

  afterUpdate() {
    // Disable pointer events on the onscreen canvas when in an immersive XR session
    this._togglePointerListeners(!this._isImmersive())

    super.afterUpdate()

    const {xrSession, _threeRenderer:renderer} = this

    const prevXrSession = _xrSessions.get(this)
    if (xrSession !== prevXrSession) {
      _xrSessions.set(this, xrSession)
      this.renderingScheduler = xrSession || window
      setAnimationScheduler(xrSession || window)
      if (xrSession) {
        let baseLayer = xrSession.renderState.baseLayer
        const gl = renderer.getContext()

        // If the session has an existing valid XRWebGLLayer, just grab its framebuffer.
        // Otherwise, create a new XRWebGLLayer
        if (baseLayer && baseLayer._glContext === gl) {
          renderer.setFramebuffer(baseLayer.framebuffer)
        } else {
          const promise = gl.makeXRCompatible ? gl.makeXRCompatible() : Promise.resolve() //not always implemented?
          promise.then(() => {
            if (this.xrSession === xrSession) {
              baseLayer = new XRWebGLLayer(xrSession, gl)
              baseLayer._glContext = gl
              xrSession.updateRenderState({ baseLayer })
              renderer.setFramebuffer(baseLayer.framebuffer)
              this._queueRender()
            }
          })
        }
      } else {
        renderer.setFramebuffer(null)
        renderer.setRenderTarget(renderer.getRenderTarget()) //see https://github.com/mrdoob/three.js/pull/15830
        // reset canvas/viewport size in case something changed it (cough cough polyfill)
        renderer.getSize(tempVec2)
        renderer.setDrawingBufferSize(tempVec2.x, tempVec2.y, renderer.getPixelRatio())
        this._queueRender()
      }
    }
  }

  /**
   * @override
   */
  doRender(timestamp, xrFrame) {
    // Invoke xrframe event handlers
    if (xrFrame && xrFrame.session) {
      this.eventRegistry.forEachListenerOfType('xrframe', fn => fn(timestamp, xrFrame), this)
    }

    super.doRender()
  }

  _isOpaque() { //TODO???
    return this.xrSession && this.xrSession.environmentBlendMode === 'opaque'
  }

  _isImmersive() {
    return this.xrSession && this.xrSessionMode !== 'inline'
  }

  /**
   * @override to use an XR stereo camera when in immersive XR mode
   */
  _getCameraDef() {
    const camera = super._getCameraDef()
    if (this._isImmersive()) {
      camera.facade = extendAsXRCamera(camera.facade)
      camera.xrSession = this.xrSession
      camera.xrReferenceSpace = this.xrReferenceSpace
    }
    return camera
  }

  /**
   * @override to add VR controllers manager object
   */
  _getSceneDef() {
    const scene = super._getSceneDef()
    const {xrSession, xrReferenceSpace} = this
    if (xrSession && xrReferenceSpace) {
      scene.objects = emptyArray.concat(
        scene.objects,
        {
          key: 'xrInputMgr',
          facade: XRInputSourceManager,
          xrSession,
          xrReferenceSpace
        }
      )
    }
    return scene
  }

  /**
   * @override to always continuously render when in XR
   */
  _isContinuousRender() {
    return this.xrSession || this.continuousRender
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


export default WorldXRFacade
