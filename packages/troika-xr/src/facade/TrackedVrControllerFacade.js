import {Ray} from 'three'
import VrController from './VrControllerFacade'
import CursorFacade from './CursorFacade'
import OculusTouchModelFacade from './controllers/OculusTouchModelFacade.js'
import BasicModelFacade from './controllers/BasicModelFacade.js'
import LaserPointerModel from './controllers/LaserPointerModel.js'


const CLICK_MAX_DUR = 300

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
      // return ray from pose
      const ray = this._pointerRay || (this._pointerRay = new Ray())
      const matrix = this.threeObject.matrixWorld
      ray.origin.setFromMatrixPosition(matrix)
      ray.direction.set(0, 0, -1).transformDirection(matrix)
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

    super.onPointerRayIntersectionChange(intersectionInfo)
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
      } else {
        this.notifyWorld('vrControllerStartPointing')
      }
    }

    super.afterUpdate()
  }
}

