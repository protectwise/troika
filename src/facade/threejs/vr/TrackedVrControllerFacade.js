import {ConeBufferGeometry, CylinderBufferGeometry, Mesh, MeshStandardMaterial, Ray} from 'three'
import Object3DFacade from '../Object3DFacade'
import VrController from './VrControllerFacade'
import CursorFacade from './CursorFacade'


const CLICK_MAX_DUR = 300


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
        facade: BasicHandModel
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
    const {event, localPoint} = intersectionInfo

    // Update cursor and laser
    const cursor = this.cursorChildDef
    if (localPoint) {
      cursor.x = localPoint.x
      cursor.y = localPoint.y
      cursor.z = localPoint.z
      cursor.visible = true
    } else {
      cursor.visible = false
    }

    // Update laser length
    this.laserChildDef.length = localPoint ? localPoint.length() : null

    super.onPointerRayIntersectionChange(intersectionInfo)
  }

  afterUpdate() {
    this.laserChildDef.visible = !!this.isPointing

    // Update current matrices from GameController pose
    const gamepad = this.gamepad
    const threeObj = this.threeObject
    let ray
    if (gamepad && gamepad.pose) {
      // Orientation
      threeObj.quaternion.fromArray(gamepad.pose.orientation)

      // Position
      if (gamepad.pose.position) {
        threeObj.position.fromArray(gamepad.pose.position)
      } else {
        // TODO arm model?
      }

      // Sync matrices to new pose components
      this._matrixChanged = true
      this.updateMatrices()
    }

    if (this.isPointing) {
      // Handle button presses - TODO figure out how to expose button presses when no pointing ray
      const buttons = gamepad.buttons
      const pressedTimes = this._buttonPresses
      const now = Date.now()
      for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].pressed !== !!pressedTimes[i]) {
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
        }
      }
      pressedTimes.length = buttons.length

      // Handle axis inputs
      // For now, only handle 2 axes, assume they're in x-y order, and map to wheel events.
      // TODO investigate better mapping
      const axes = gamepad.axes
      const deltaX = (axes[0] || 0) * 10
      const deltaY = (axes[1] || 0) * 10
      if (deltaX || deltaY) {
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
      }
    }

    super.afterUpdate()
  }
}

function updateFacadeMatrices(facade) {
  facade.updateMatrices && facade.updateMatrices()
}



class BasicHandModel extends Object3DFacade {
  constructor(parent) {
    const mesh = new Mesh(BasicHandModel.geometry, BasicHandModel.material)
    super(parent, mesh)
  }
}
BasicHandModel.geometry = new ConeBufferGeometry(0.05, 0.2, 16).rotateX(Math.PI / -2)
BasicHandModel.material = new MeshStandardMaterial({
  transparent: true,
  opacity: 0.8,
  color: 0x006699,
  emissive: 0x006699
})


class LaserPointerModel extends Object3DFacade {
  constructor(parent) {
    const mesh = new Mesh(LaserPointerModel.geometry, LaserPointerModel.material)
    super(parent, mesh)
  }
  set length(val) {
    this.scaleZ = val || 1e10
  }
}
LaserPointerModel.geometry = new CylinderBufferGeometry(0.001, 0.001, 1).translate(0, 0.5, 0).rotateX(Math.PI / -2)
LaserPointerModel.material = new MeshStandardMaterial({
  transparent: true,
  opacity: 0.2,
  color: 0x006699,
  emissive: 0x006699
})
