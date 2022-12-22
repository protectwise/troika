/*global XRWebGLLayer*/

import { World3DFacade } from 'troika-3d'
import { setAnimationScheduler } from 'troika-animation'
import { XRInputSourceManager } from './XRInputSourceManager.js'
import { extendAsXRCamera } from './XRCameraFacade.js'
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
   * @property {number|string} xrFramebufferScaleFactor
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
          bindFramebuffer(renderer, baseLayer.framebuffer)
        } else {
          const promise = gl.makeXRCompatible ? gl.makeXRCompatible() : Promise.resolve() //not always implemented?
          promise.then(() => {
            if (this.xrSession === xrSession) {
              baseLayer = new XRWebGLLayer(xrSession, gl, {
                antialias: !!renderer.getContextAttributes().antialias,
                framebufferScaleFactor: parseFramebufferScaleFactor(this.xrFramebufferScaleFactor, xrSession)
              })
              baseLayer._glContext = gl
              xrSession.updateRenderState({ baseLayer })
              bindFramebuffer(renderer, baseLayer.framebuffer)
              this._queueRender()
            }
          })
        }
      } else {
        bindFramebuffer(renderer, null)
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

WorldXRFacade.prototype._notifyWorldHandlers = Object.create(
  World3DFacade.prototype._notifyWorldHandlers,
  {
    // notification to end the XR session
    endXRSession: {
      value: function(source, data) {
        if (this.xrSession) {
          this.xrSession.end()
        }
      }
    }
  }
)

function parseFramebufferScaleFactor(value, xrSession) {
  let scale = 1
  if (value != null) {
    if (typeof value === 'string') {
      if (/native/.test(value)) {
        const mult = +value.replace(/\s*native\s*/, '') || 1
        const nativeScale = XRWebGLLayer.getNativeFramebufferScaleFactor(xrSession)
        scale = nativeScale * mult
      }
    } else {
      scale = +value
    }
    if (isNaN(scale)) scale = 1
  }
  //console.info(`WebXR: using framebufferScaleFactor ${scale}`)
  return scale
}

// Smooth out r127 framebuffer state refactor
function bindFramebuffer(renderer, framebuffer) {
  if (renderer.setFramebuffer) { //pre-r127
    renderer.setFramebuffer(framebuffer)
  } else if (renderer.state.bindXRFramebuffer) {
    renderer.state.bindXRFramebuffer(framebuffer)
  } else {
    renderer.state.bindFramebuffer(framebuffer)
  }
}

export default WorldXRFacade
