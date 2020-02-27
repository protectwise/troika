import { Group3DFacade, Object3DFacade } from 'troika-3d'
import { Facade, utils } from 'troika-core'
import { Matrix4, Ray } from 'three'
import CursorFacade from './CursorFacade.js'
import TargetRayFacade from './TargetRayFacade.js'
import GripFacade from './GripFacade.js'
import { BUTTON_DEFAULT_BACK, BUTTON_SQUEEZE, BUTTON_TRIGGER } from '../XRStandardGamepadMapping.js'

const SCENE_EVENTS = ['mousemove', 'mouseover', 'mouseout', 'mousedown', 'mouseup', 'click']
const XRSESSION_EVENTS = ['selectstart', 'selectend', 'squeezestart', 'squeezeend']
const CLICK_MAX_DUR = 300

const HAPTICS = { //TODO allow control
  mouseover: {value: 0.3, duration: 10},
  click: {value: 1, duration: 20}
}

const DEFAULT_CURSOR = {
  facade: CursorFacade
}
const DEFAULT_TARGET_RAY = {
  facade: TargetRayFacade
}
const DEFAULT_GRIP = {
  facade: GripFacade
}

function toggleEvents (target, on, eventTypes, handler) {
  if (target) {
    eventTypes.forEach(type => {
      target[`${on ? 'add' : 'remove'}EventListener`](type, handler)
    })
  }
}

const tempMat4 = new Matrix4()

/**
 * Controls the behavior and visual representation of a single XRInputSource.
 *
 * |                   | Highlight | Cursor | Pointing Ray | Renderable Model |
 * | ------------------| --------- | ------ | ------------ | ---------------- |
 * | 'screen'          | √         | X      | X            | X                |
 * | 'gaze'            | √         | √      | X            | X                |
 * | 'tracked-pointer' | √         | √      | √            | √ (if possible)  |
 */
class XRInputSourceFacade extends Group3DFacade {
  constructor (parent) {
    super(parent)
    this.isXRInputSource = true

    // Required props
    this.xrInputSource = null
    this.xrSession = null
    this.xrReferenceSpace = null

    // Current frame state data, passed to all children:
    this.targetRayPose = null
    this.gripPose = null
    this.rayIntersection = null

    // Child object configs:
    this.cursor = utils.assign(DEFAULT_CURSOR)
    this.targetRay = utils.assign(DEFAULT_TARGET_RAY)
    this.grip = utils.assign(DEFAULT_GRIP)

    // Pointing - true for all inputs by default
    this.isPointing = true

    this.clickOnPoke = false

    this.children = [
      null, //cursor
      null, //targetRay
      null //grip
    ]

    this._ray = new Ray()

    this._onSessionEvent = this._onSessionEvent.bind(this)
    this._onSceneRayEvent = this._onSceneRayEvent.bind(this)
    this.addEventListener('xrframe', this._onXrFrame.bind(this))

    // Listen to ray intersection related events at the scene level, so we can respond to intersection changes
    toggleEvents(this.getSceneFacade(), true, SCENE_EVENTS, this._onSceneRayEvent)
  }

  afterUpdate () {
    const {xrSession, _lastXrSession, xrInputSource, rayIntersection, children, isPointing, cursor, targetRay, grip, targetRayPose, gripPose} = this

    if (xrSession !== _lastXrSession) {
      this._lastXrSession = xrSession
      toggleEvents(_lastXrSession, false, XRSESSION_EVENTS, this._onSessionEvent)
      // Only listen for XRSession 'select' event if we won't be handling the xr-standard
      // gamepad button tracking ourselves
      if (!this._isXrStandardGamepad()) {
        toggleEvents(xrSession, true, XRSESSION_EVENTS, this._onSessionEvent)
      }
    }

    // Update child objects
    let cursorCfg = null, targetRayCfg = null, gripCfg = null
    if (xrInputSource.targetRayMode !== 'screen') {
      cursorCfg = isPointing && cursor
      if (cursorCfg) {
        cursorCfg.key = 'cursor'
        cursorCfg.targetRayPose = targetRayPose
        cursorCfg.gripPose = gripPose
        cursorCfg.rayIntersection = rayIntersection
        cursorCfg.xrInputSource = xrInputSource
      }
    }
    if (xrInputSource.targetRayMode === 'tracked-pointer') {
      targetRayCfg = isPointing && targetRay
      if (targetRayCfg) {
        targetRayCfg.key = 'targetRay'
        targetRayCfg.targetRayPose = targetRayPose
        targetRayCfg.gripPose = gripPose
        targetRayCfg.rayIntersection = rayIntersection
        targetRayCfg.xrInputSource = xrInputSource
      }
      gripCfg = gripPose ? grip : null
      if (gripCfg) {
        gripCfg.key = 'grip'
        gripCfg.targetRayPose = targetRayPose
        gripCfg.gripPose = gripPose
        gripCfg.rayIntersection = rayIntersection
        gripCfg.xrInputSource = xrInputSource
      }
    }
    children[0] = cursorCfg
    children[1] = targetRayCfg
    children[2] = gripCfg

    super.afterUpdate()
  }

  _onXrFrame (time, xrFrame) {
    const {xrInputSource, isPointing, _ray: ray} = this
    const offsetReferenceSpace = this.getCameraFacade().offsetReferenceSpace

    if (offsetReferenceSpace) {
      // Update current poses
      const {targetRaySpace, gripSpace} = xrInputSource
      const targetRayPose = xrFrame.getPose(targetRaySpace, offsetReferenceSpace)
      if (targetRayPose && isPointing) {
        ray.origin.copy(targetRayPose.transform.position)
        ray.direction.set(0, 0, -1).applyQuaternion(targetRayPose.transform.orientation)
        this.notifyWorld('rayPointerMotion', ray)
      }
      this.targetRayPose = targetRayPose
      this.gripPose = gripSpace ? xrFrame.getPose(gripSpace, offsetReferenceSpace) : null
    }

    // If this is a tracked-pointer with a gamepad, track its button/axis states
    if (this._isXrStandardGamepad()) {
      this._trackGamepadState(xrInputSource.gamepad)
    }

    this.afterUpdate()
  }

  _isXrStandardGamepad() {
    const {gamepad} = this.xrInputSource
    return gamepad && gamepad.mapping === 'xr-standard'
  }

  _trackGamepadState(gamepad) {
    // Handle button presses
    const buttons = gamepad.buttons
    const pressedTimes = this._buttonPresses || (this._buttonPresses = [])
    const now = Date.now()
    const ray = this._ray //assumes already updated to current frame pose
    for (let i = 0; i < buttons.length; i++) {
      if (buttons[i].pressed !== !!pressedTimes[i]) {
        if (this.isPointing) {
          this.notifyWorld('rayPointerAction', {
            ray,
            type: buttons[i].pressed ? 'mousedown' : 'mouseup',
            button: i
          })
          if (pressedTimes[i] && !buttons[i].pressed && now - pressedTimes[i] <= CLICK_MAX_DUR) {
            this.notifyWorld('rayPointerAction', {
              ray,
              type: 'click',
              button: i
            })
          }
        }
        pressedTimes[i] = buttons[i].pressed ? now : null
      }
      pressedTimes.length = buttons.length
    }

    // Handle axis inputs
    const axes = gamepad.axes
    for (let i = 0; i < axes.length; i += 2) {
      // Map each pair of axes to wheel event deltaX/Y
      // TODO investigate better mapping
      const deltaX = (axes[i] || 0) * 10
      const deltaY = (axes[i + 1] || 0) * 10
      if (Math.hypot(deltaX, deltaY) > 0.1) {
        if (this.isPointing) {
          this.notifyWorld('rayPointerAction', {
            ray,
            type: 'wheel',
            deltaX,
            deltaY,
            deltaMode: 0 //pixel mode
          })
        }
      }
    }
  }

  _onSessionEvent (e) {
    if (e.inputSource === this.xrInputSource) {
      // Redispatch select and squeeze events as standard pointer events to the world's event system.
      // Note this is only used for non xr-standard gamepad inputs, otherwise it's handled in the
      // gamepad button state tracking.
      const button = /^squeeze/.test(e.type) ? BUTTON_SQUEEZE : BUTTON_TRIGGER
      this.notifyWorld('rayPointerAction', {
        ray: this._ray,
        type: /start$/.test(e.type) ? 'mousedown' : 'mouseup',
        button
      })
      // If this was an "end" event, then we'll also want to fire a click event after the mouseup.
      // This is a workaround for the fact that WebXR fires 'select' then 'selectend', which doesn't
      // match with standard DOM mouse events which go 'mouseup' then 'click', and can lead to
      // unexpected behaviors in downstram code that assumes the standard order.
      if (/end$/.test(e.type)) {
        this.notifyWorld('rayPointerAction', {
          ray: this._ray,
          type: 'click',
          button
        })
      }
    }
  }

  _onSceneRayEvent (e) {
    // Only handle events where this was the ray's source
    if (e.nativeEvent.eventSource === this) {
      const {gamepad, targetRayMode} = this.xrInputSource

      // Copy intersection info to local state and update subtree
      this.rayIntersection = e.intersection
      this.afterUpdate()

      // If haptics available, trigger a pulse
      if (gamepad) {
        const isScene = e.target === e.currentTarget
        const hapticPulse = e.type === 'click' ? HAPTICS.click
          : (e.type === 'mouseover' && !isScene) ? HAPTICS.mouseover
          : null
        if (hapticPulse) {
          const hapticActuator = gamepad.hapticActuators && gamepad.hapticActuators[0]
          if (hapticActuator) {
            hapticActuator.pulse(hapticPulse.value || 1, hapticPulse.duration || 100)
          }
        }
      }

      // For gamepad buttons and select/squeeze session events, dispatch custom xr-specific
      // events to the raycasted target facade:
      let defaultPrevented = e.defaultPrevented
      const fireEvent = type => {
        if (type) {
          const customEvent = new Event(type, {bubbles: true})
          customEvent.eventSource = this
          e.target.dispatchEvent(customEvent)
          defaultPrevented = defaultPrevented || customEvent.defaultPrevented
        }
      }
      //TODO: fireEvent(RAY_TARGET_EVENTS.all[e.type]) //all buttons
      fireEvent(RAY_TARGET_EVENTS[e.button] && RAY_TARGET_EVENTS[e.button][e.type]) //special select/squeeze

      // Default gamepad button mapping to exit the XR session; authors can override this
      // to use that button for other things by calling `preventDefault()`
      if (!defaultPrevented && e.type === 'click' && e.button === BUTTON_DEFAULT_BACK) {
        this.notifyWorld('endXRSession')
      }

      // Check physical proximity to trigger a click when poking an object
      if (targetRayMode === 'tracked-pointer' && this.clickOnPoke) {
        this._checkPokeGesture(e)
      }
    }
  }

  _checkPokeGesture(e) {
    const DEBOUNCE = 500
    const RAY_DISTANCE = 0.1 //slight buffer
    const {intersection, target} = e
    const pokeState = this._pokeState || (this._pokeState = {target: null, isPoking: false, time: 0})
    const isPoking = !!intersection && intersection.distance < RAY_DISTANCE
    if (isPoking && (!pokeState.isPoking || target !== pokeState.target) && Date.now() - pokeState.time > DEBOUNCE) {
      pokeState.time = Date.now()
      this.notifyWorld('rayPointerAction', {
        ray: e.ray,
        type: 'click',
        button: BUTTON_TRIGGER
      })
    }
    pokeState.isPoking = isPoking
    pokeState.target = target
  }

  destructor () {
    toggleEvents(this.xrSession, false, XRSESSION_EVENTS, this._onSessionEvent)
    toggleEvents(this.getSceneFacade(), false, SCENE_EVENTS, this._onSceneRayEvent)
    super.destructor()
  }
}

// this.onXrFrame = null //timestamp, XRFrame
// this.onIntersectionEvent = null //???
// this.onSelectStart = null
// this.onSelect = null
// this.onSelectEnd = null
// this.onSqueezeStart = null
// this.onSqueeze = null
// this.onSqueezeEnd = null
// this.onButtonTouchStart = null
// this.onButtonPressStart = null
// this.onButtonPress = null
// this.onButtonPressEnd = null
// this.onButtonTouchEnd = null


// Define some custom xr-specific events that will be dispatched to the target Object3DFacade
// intersecting the ray at the time of a button action:
const RAY_TARGET_EVENTS = {
  [BUTTON_TRIGGER]: {
    mousedown: 'xrselectstart',
    mouseup: 'xrselectend',
    click: 'xrselect'
  },
  [BUTTON_SQUEEZE]: {
    mousedown: 'xrsqueezestart',
    mouseup: 'xrsqueezeend',
    click: 'xrsqueeze'
  },
  // TODO decide on event names, and handle touching without press:
  // all: {
  //   mousedown: 'xrbuttondown',
  //   mouseup: 'xrbuttonup',
  //   click: 'xrbuttonclick'
  // }
}

// ...and add shortcut event handler properties on Object3DFacade for those events:
Facade.defineEventProperty(Object3DFacade, 'onXRSelectStart', 'xrselectstart')
Facade.defineEventProperty(Object3DFacade, 'onXRSelect', 'xrselect')
Facade.defineEventProperty(Object3DFacade, 'onXRSelectEnd', 'xrselectend')
Facade.defineEventProperty(Object3DFacade, 'onXRSqueezeStart', 'xrsqueezestart')
Facade.defineEventProperty(Object3DFacade, 'onXRSqueeze', 'xrsqueeze')
Facade.defineEventProperty(Object3DFacade, 'onXRSqueezeEnd', 'xrsqueezeend')


export default XRInputSourceFacade
