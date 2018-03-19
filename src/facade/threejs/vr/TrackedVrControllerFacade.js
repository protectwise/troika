import {ConeBufferGeometry, CylinderBufferGeometry, Mesh, MeshStandardMaterial, Ray} from 'three'
import Object3DFacade from '../Object3DFacade'
import VrController from './VrControllerFacade'


const CLICK_MAX_DUR = 300

export default class TrackedVrController extends VrController {

  constructor(parent) {
    super(parent)
    this.children = {
      key: 'model',
      facade: BasicControllerModel
    }
    this._buttonPresses = []
  }

  afterUpdate() {
    this.children.showLaser = this.isPointing
    super.afterUpdate()
  }

  getPointerRay() {
    if (this.isPointing) {
      // return ray from pose - assume it's up to date
      const ray = this._pointerRay || (this._pointerRay = new Ray())
      const matrix = this.threeObject.matrixWorld
      ray.origin.setFromMatrixPosition(matrix)
      ray.direction.set(0, 0, -1).transformDirection(matrix)
      return ray
    }
  }

  onBeforeRender(renderer, scene, camera) {
    // Update current matrices from GameController pose
    const gamepad = this.gamepad
    const threeObj = this.threeObject
    if (gamepad && gamepad.pose) {
      // Orientation
      threeObj.quaternion.fromArray(gamepad.pose.orientation)

      // Position
      if (gamepad.pose.position) {
        threeObj.position.fromArray(gamepad.pose.position)
      } else {
        // TODO arm model?
      }

      // Sync matrices for this and all children
      this._matrixChanged = true
      this.traverse(updateFacadeMatrices)
    }

    // Handle button presses
    const buttons = gamepad.buttons
    const pressedTimes = this._buttonPresses
    const now = Date.now()
    let ray
    for (let i = 0; i < buttons.length; i++) {
      if (buttons[i].pressed !== !!pressedTimes[i]) {
        if (!ray) ray = this.getPointerRay()
        this.notifyWorld('pointerRayAction', {ray, type: buttons[i].pressed ? 'mousedown' : 'mouseup', button: i})
        if (pressedTimes[i] && !buttons[i].pressed && now - pressedTimes[i] <= CLICK_MAX_DUR) {
          this.notifyWorld('pointerRayAction', {ray, type: 'click', button: i})
        }
        pressedTimes[i] = buttons[i].pressed ? now : null
      }
    }
    pressedTimes.length = buttons.length

    super.onBeforeRender()
  }

}

function updateFacadeMatrices(facade) {
  facade.updateMatrices && facade.updateMatrices()
}



class BasicControllerModel extends Object3DFacade {
  constructor(parent) {
    const mesh = new Mesh(BasicControllerModel.geometry, BasicControllerModel.material)
    super(parent, mesh)
    this._laser = {
      key: 'laser',
      facade: LaserPointerModel,
      raycast: null,
      getBoundingSphere: null
    }
  }

  afterUpdate() {
    this.children = this.showLaser ? this._laser : null
    super.afterUpdate()
  }
}
BasicControllerModel.geometry = new ConeBufferGeometry(0.05, 0.2, 16).rotateX(Math.PI / -2)
BasicControllerModel.material = new MeshStandardMaterial({
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
}
LaserPointerModel.geometry = new CylinderBufferGeometry(0.001, 0.001, 1).translate(0, 0.5, 0).rotateX(Math.PI / -2).scale(1, 1, 1e10)
LaserPointerModel.material = new MeshStandardMaterial({
  transparent: true,
  opacity: 0.2,
  color: 0x006699,
  emissive: 0x006699
})
