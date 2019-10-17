import {Ray, Vector3} from 'three'
import VrController from './VrControllerFacade'
import CursorFacade from './CursorFacade'
import OculusTouchModelFacade from './controllers/OculusTouchModelFacade.js'
import BasicModelFacade from './controllers/BasicModelFacade.js'
import LaserPointerModel from './controllers/LaserPointerModel.js'


const CLICK_MAX_DUR = 300

const DEFAULT_POINTER_RAY = new Ray(
  new Vector3(0, 0, 0),
  new Vector3(0, 0, -1)
)

// Mapping of gamepad ids to controller model facades
const CONTROLLER_MODELS = {
  'Oculus Touch (Left)': OculusTouchModelFacade,
  'Oculus Touch (Right)': OculusTouchModelFacade
}



/**
 * A handheld VR controller that is tracked in space, exposed via the gamepad API. May
 * have a laser pointer ray that is used to interact with intersecting objects. Mouse
 * events are fired for any button press, and stick axis changes are fired as wheel
 * events.
 *
 * Currently renders a very simple cone model at the position/orientation of the
 * controller. In the future this model will be improved and made configurable.
 */
export default class TrackedVrController extends VrController {

  constructor(parent) {
    super(parent)
    this._buttonPresses = []
    this._bumpingState = {target: null, isBumping: false, time: 0}

    this.children = [
      this.modelChildDef = {
        key: 'model',
        facade: null //chosen in afterUpdate
      },
      this.laserChildDef = {
        key: 'laser',
        facade: LaserPointerModel
      },
      this.cursorChildDef = {
        key: 'cursor',
        facade: CursorFacade
      }
    ]
  }

  getPointerRay() {
    if (this.isPointing) {
      // get local ray from controller model
      const model = this.getChildByKey('model')
      const modelRay = (model && model.pointerRay) || DEFAULT_POINTER_RAY

      // return ray from pose
      const ray = this._pointerRay || (this._pointerRay = new Ray())
      const matrix = this.threeObject.matrixWorld
      ray.copy(modelRay).applyMatrix4(matrix)
      return ray
    }
  }

  /**
   * @override
   */
  onPointerRayIntersectionChange(intersectionInfo) {
    const {gamepad, cursorChildDef, laserChildDef} = this
    const {event, localPoint, hapticPulse} = intersectionInfo

    // Update cursor and laser
    if (localPoint) {
      cursorChildDef.x = localPoint.x
      cursorChildDef.y = localPoint.y
      cursorChildDef.z = localPoint.z
      cursorChildDef.visible = true
    } else {
      cursorChildDef.visible = false
    }

    // Haptics
    if (hapticPulse) {
      const actuator = gamepad.hapticActuators && gamepad.hapticActuators[0]
      if (actuator) {
        actuator.pulse(hapticPulse.value || 1, hapticPulse.duration || 100)
      }
    }

    // Update laser length
    laserChildDef.visible = true
    laserChildDef.length = localPoint ? localPoint.length() : null

    // Check physical proximity based press
    this._checkBumping(event)

    super.onPointerRayIntersectionChange(intersectionInfo)
  }

  _checkBumping(event) {
    const DEBOUNCE = 500 //todo debounce quick exit+enter of same target?
    const RAY_DISTANCE = 0.02 //slight buffer
    const {intersection, target} = event
    const bumpingState = this._bumpingState
    const isBumping = !!intersection && intersection.distance < RAY_DISTANCE

    if (isBumping && (!bumpingState.isBumping || target !== bumpingState.target) && Date.now() - bumpingState.time > DEBOUNCE) {
      bumpingState.time = Date.now()
      this.notifyWorld('rayPointerAction', {
        ray: event.ray,
        type: 'click'
      })
    }
    bumpingState.isBumping = isBumping
    bumpingState.target = target
  }

  afterUpdate() {
    const {gamepad, isPointing, threeObject} = this

    if (!isPointing) {
      this.laserChildDef.visible = this.cursorChildDef.visible = false
    }

    // Update current matrices from GameController pose
    let ray
    if (gamepad && gamepad.pose) {
      this.modelChildDef.facade = CONTROLLER_MODELS[gamepad.id] || BasicModelFacade
      this.modelChildDef.hand = gamepad.hand || 'right'

      // Orientation
      threeObject.quaternion.fromArray(gamepad.pose.orientation)

      // Position
      if (gamepad.pose.position) {
        threeObject.position.fromArray(gamepad.pose.position)
      } else {
        // TODO arm model?
        threeObject.position.set(0.2, -0.5, -0.25)
      }

      // Sync matrices to new pose components
      this._matrixChanged = true
      this.updateMatrices()
    }

    // Handle button presses - TODO figure out how to expose button presses when no pointing ray
    const buttons = gamepad.buttons
    const pressedTimes = this._buttonPresses
    const now = Date.now()
    for (let i = 0; i < buttons.length; i++) {
      if (buttons[i].pressed !== !!pressedTimes[i]) {
        if (isPointing) {
          if (!ray) ray = this.getPointerRay()
          if (ray) {
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
        } else {
          this.notifyWorld('vrControllerStartPointing')
        }
      }
      pressedTimes.length = buttons.length
    }

    // Handle axis inputs
    // For now, only handle 2 axes, assume they're in x-y order, and map to wheel events.
    // TODO investigate better mapping
    const axes = gamepad.axes
    const deltaX = (axes[0] || 0) * 10
    const deltaY = (axes[1] || 0) * 10
    if (deltaX || deltaY) {
      if (isPointing) {
        if (!ray) ray = this.getPointerRay()
        if (ray) {
          this.notifyWorld('rayPointerAction', {
            ray,
            type: 'wheel',
            deltaX,
            deltaY,
            deltaMode: 0 //pixel mode
          })
        }
      } else if (Math.hypot(deltaX, deltaY) > 0.1) {
        this.notifyWorld('vrControllerStartPointing')
      }
    }

    super.afterUpdate()
  }
}

