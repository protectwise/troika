import { Group3DFacade } from 'troika-3d'
import { ParentFacade, utils } from 'troika-core'
import { Matrix4, Ray } from 'three'
import CursorFacade from './CursorFacade'
import TargetRayFacade from './TargetRayFacade'
import GripFacade from './GripFacade'

const SCENE_EVENTS = ['mousemove', 'mouseover', 'click']
const XRSESSION_EVENTS = ['selectstart', 'select', 'selectend']

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

function toggleEvents(target, on, eventTypes, handler) {
  if (target) {
    eventTypes.forEach(type => {
      target[`${on ? 'add' : 'remove'}EventListener`](type, handler)
    })
  }
}

function matricesTraversal(facade) {
  facade.updateMatrices()
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
  constructor(parent) {
    super(parent)

    // Required props
    this.xrInputSource = null
    this.xrSession = null
    this.xrReferenceSpace = null

    this._ray = new Ray()

    // Current frame state data, passed to all children:
    this.targetRayPose = null
    this.gripPose = null
    this.rayIntersection = null

    // Child object configs:
    this.cursor = utils.assign(DEFAULT_CURSOR)
    this.targetRay = utils.assign(DEFAULT_TARGET_RAY)
    this.grip = utils.assign(DEFAULT_GRIP)

    this.children = [
      null, //cursor
      null, //targetRay
      null //grip
    ]

    this._onSelectEvent = this._onSelectEvent.bind(this)
    this._onSceneRayEvent = this._onSceneRayEvent.bind(this)
    this.addEventListener('xrframe', this._onXrFrame.bind(this))

    // Listen to ray intersection related events at the scene level, so we can respond to intersection changes
    toggleEvents(this.getSceneFacade(), true, SCENE_EVENTS, this._onSceneRayEvent)
  }

  afterUpdate() {
    const {xrSession, _lastXrSession, xrInputSource, rayIntersection, children, cursor, targetRay, grip} = this
    if (xrSession !== _lastXrSession) {
      this._lastXrSession = xrSession
      toggleEvents(_lastXrSession, false, XRSESSION_EVENTS, this._onSelectEvent)
      toggleEvents(xrSession, true, XRSESSION_EVENTS, this._onSelectEvent)
    }

    // Update child objects
    let cursorCfg = null, targetRayCfg = null, gripCfg = null
    if (xrInputSource.targetRayMode !== 'screen') {
      cursorCfg = cursor
      if (cursorCfg) {
        cursorCfg.key = 'cursor'
        cursorCfg.targetRayPose = this.targetRayPose
        cursorCfg.gripPose = this.gripPose
        cursorCfg.rayIntersection = rayIntersection
        cursorCfg.xrInputSource = xrInputSource
      }
    }
    if (xrInputSource.targetRayMode === 'tracked-pointer') {
      targetRayCfg = targetRay
      if (targetRayCfg) {
        targetRayCfg.key = 'targetRay'
        targetRayCfg.targetRayPose = this.targetRayPose
        targetRayCfg.gripPose = this.gripPose
        targetRayCfg.rayIntersection = rayIntersection
        targetRayCfg.xrInputSource = xrInputSource
      }
      gripCfg = grip
      if (gripCfg) {
        gripCfg.key = 'grip'
        gripCfg.targetRayPose = this.targetRayPose
        gripCfg.gripPose = this.gripPose
        gripCfg.rayIntersection = rayIntersection
        gripCfg.xrInputSource = xrInputSource
      }
    }
    children[0] = cursorCfg
    children[1] = targetRayCfg
    children[2] = gripCfg

    super.afterUpdate()
  }


  _onXrFrame(time, xrFrame) {
    // TODO offset the ref space the same way as the camera (?)
    const {xrInputSource, xrReferenceSpace, _ray:ray} = this
    const {targetRaySpace, gripSpace} = xrInputSource
    const offsetReferenceSpace = xrReferenceSpace.getOffsetReferenceSpace(
      this.getCameraFacade().xrOffsetTransform
    )

    const targetRayPose = xrFrame.getPose(targetRaySpace, offsetReferenceSpace)
    if (targetRayPose) {
      ray.direction.set(0, 0, -1)
      ray.origin.set(0, 0, 0)
      ray.applyMatrix4(tempMat4.fromArray(targetRayPose.transform.matrix))
      this.notifyWorld('rayPointerMotion', ray)

      // Update targetRaySpace transform
      // this._syncFacadeToPose(this.getChildByKey('cursor'), targetRayPose)
      // this._syncFacadeToPose(this.getChildByKey('targetRay'), targetRayPose)
    }
    this.targetRayPose = targetRayPose

    // Update gripSpace child group transform
    this.gripPose = gripSpace ? xrFrame.getPose(gripSpace, offsetReferenceSpace) : null

    // If this is a tracked-pointer with a gamepad, track its button/axis states
    // Need to figure out how (or if we need) to exclude the primary button which would already fire select events

    this.afterUpdate()
  }

  _onSelectEvent(e) {

  }

  _onSceneRayEvent(e) {
    // Only handle events where this was the ray's source
    if (e.nativeEvent.raySource === this) {
      const {xrInputSource, children} = this
      const {targetRayMode, gamepad} = xrInputSource
      const isScene = e.target === e.currentTarget
      const worldPoint = e.intersection && e.intersection.point

      this.rayIntersection = e.intersection
      this.afterUpdate()

      // If gaze or tracked-pointer, set the cursor to the intersection point if any
      // const cursorFacade = this.getChildByKey('cursor')
      // if (targetRayMode !== 'screen' && cursorFacade) {
      //   if (worldPoint) {
      //     cursorFacade.visible = true
      //     cursorFacade.x = worldPoint.x
      //     cursorFacade.y = worldPoint.y
      //     cursorFacade.z = worldPoint.z
      //     // TODO scale based on camera distance?
      //   } else {
      //     cursorFacade.visible = false
      //   }
      //   cursorFacade.afterUpdate()
      // }

      // If tracked-pointer, set the targetRay length to match the intersection point if any
      // if (targetRayMode === 'tracked-pointer') {
      //   const laserChild = children[1] || (children[1] = {key: 'laser', facade: LaserFacade})
      //
      //   // Update the laser length to match the intersection if any
      //   laserChild.length = e.intersection && e.intersection.distance || null
      //
      //   // If haptics available, trigger a pulse
      //   const hapticPulse = e.type === 'click' ? HAPTICS.click
      //     : (e.type === 'mouseover' && !isScene) ? HAPTICS.mouseover
      //     : null
      //   if (hapticPulse) {
      //     const hapticActuator = gamepad && gamepad.hapticActuators && gamepad.hapticActuators[0]
      //     if (hapticActuator) {
      //       hapticActuator.pulse(hapticPulse.value || 1, hapticPulse.duration || 100)
      //     }
      //   }
      // }
    }
  }

  destructor() {
    toggleEvents(this.xrSession, false, XRSESSION_EVENTS, this._onSelectEvent)
    toggleEvents(this.getSceneFacade(), false, SCENE_EVENTS, this._onSceneRayEvent)
    super.destructor()
  }

}

export default XrInputSourceFacade
