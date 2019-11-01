import { Group3DFacade } from 'troika-3d'
import { Facade, utils } from 'troika-core'
import { Matrix4, Ray } from 'three'
import CursorFacade from './CursorFacade'
import TargetRayFacade from './TargetRayFacade'
import GripFacade from './GripFacade'
import { BUTTON_TRIGGER } from '../xrStandardGamepadMapping'

const SCENE_EVENTS = ['mousemove', 'mouseover', 'click']
const XRSESSION_EVENTS = ['selectstart', 'select', 'selectend']
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
class XrInputSourceFacade extends Group3DFacade {
  constructor (parent) {
    super(parent)

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

    this.children = [
      null, //cursor
      null, //targetRay
      null //grip
    ]

    this._ray = new Ray()

    this._onSelectEvent = this._onSelectEvent.bind(this)
    this._onSceneRayEvent = this._onSceneRayEvent.bind(this)
    this.addEventListener('xrframe', this._onXrFrame.bind(this))

    // Listen to ray intersection related events at the scene level, so we can respond to intersection changes
    toggleEvents(this.getSceneFacade(), true, SCENE_EVENTS, this._onSceneRayEvent)
  }

  afterUpdate () {
    const {xrSession, _lastXrSession, xrInputSource, rayIntersection, children, isPointing, cursor, targetRay, grip, targetRayPose, gripPose} = this

    if (xrSession !== _lastXrSession) {
      this._lastXrSession = xrSession
      toggleEvents(_lastXrSession, false, XRSESSION_EVENTS, this._onSelectEvent)
      // Only listen for XRSession 'select' event if we won't be handling the xr-standard
      // gamepad button tracking ourselves
      if (!this._isXrStandardGamepad()) {
        toggleEvents(xrSession, true, XRSESSION_EVENTS, this._onSelectEvent)
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
    // TODO offset the ref space the same way as the camera (?)
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

  _onSelectEvent (e) {
    this.notifyWorld('rayPointerAction', {
      ray: this._ray,
      type: e.type === 'select' ? 'click' : e.type === 'selectstart' ? 'mousedown' : 'mouseup',
      button: BUTTON_TRIGGER
    })
    const handlerMethod = e.type === 'select' ? 'onSelect' : e.type === 'selectstart' ? 'onSelectStart' : 'onSelectEnd'
    if (this[handlerMethod]) {
      this[handlerMethod](e)
    }
  }

  _onSceneRayEvent (e) {
    // Only handle events where this was the ray's source
    if (e.nativeEvent.eventSource === this) {
      // Copy intersection info to local state and update subtree
      this.rayIntersection = e.intersection
      this.afterUpdate()

      // If haptics available, trigger a pulse
      const isScene = e.target === e.currentTarget
      const hapticPulse = e.type === 'click' ? HAPTICS.click
        : (e.type === 'mouseover' && !isScene) ? HAPTICS.mouseover
        : null
      if (hapticPulse) {
        const {gamepad} = this.xrInputSource
        const hapticActuator = gamepad && gamepad.hapticActuators && gamepad.hapticActuators[0]
        if (hapticActuator) {
          hapticActuator.pulse(hapticPulse.value || 1, hapticPulse.duration || 100)
        }
      }
    }
  }

  destructor () {
    toggleEvents(this.xrSession, false, XRSESSION_EVENTS, this._onSelectEvent)
    toggleEvents(this.getSceneFacade(), false, SCENE_EVENTS, this._onSceneRayEvent)
    super.destructor()
  }
}

export default XrInputSourceFacade
