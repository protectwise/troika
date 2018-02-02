

/*

TODO CLEANUP

*/




import {arraysAreEqual} from '../../../utils'
import Group3DFacade from '../Group3D'
import Object3DFacade from '../Object3D'
import {ConeBufferGeometry, CylinderBufferGeometry, Mesh, MeshStandardMaterial, Ray} from 'three'



const raycastFrequency = 50


class VrController extends Group3DFacade {

  constructor(parent) {
    super(parent)
    this.onBeforeRender = this.onBeforeRender.bind(this)
  }

  onBeforeRender(renderer, scene, camera) {
    // If it has a pointer ray, trigger a raycast
    // TODO verify onBeforeRender is the right time to do this???
    const now = Date.now()
    if (now - (this._lastRaycast || 0) > raycastFrequency) {
      const ray = this.getPointerRay() //may be null
      this.notifyWorld('pointerRayChanged', ray)
      this._lastRaycast = now
    }
  }

  getPointerRay() {
    return null
  }

}


class GazeVrController extends VrController {

  getPointerRay() {
    // return ray from camera
    const camera = this.getCameraFacade()
    camera.updateMatrices() //TODO needed?
    const camMatrix = camera.threeObject.matrixWorld

    const ray = this._pointerRay || (this._pointerRay = new Ray())
    ray.origin.setFromMatrixPosition(camMatrix)
    ray.direction.set(0, 0, -1).transformDirection(camMatrix)
    return ray
  }

}


class TrackedVrController extends VrController {

  constructor(parent) {
    super(parent)
    this.children = {
      key: 'model',
      facade: BasicControllerModel
    }
  }

  getPointerRay() {
    // return ray from pose - assume it's up to date
    const ray = this._pointerRay || (this._pointerRay = new Ray())
    const matrix = this.threeObject.matrixWorld
    ray.origin.setFromMatrixPosition(matrix)
    ray.direction.set(0, 0, -1).transformDirection(matrix)
    return ray
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

      // sync matrices for this and all children
      this._matrixChanged = true
      this.traverse(updateFacadeMatrices)
    }

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
    this.children = {
      key: 'laser',
      facade: LaserPointerModel,
      raycast: null,
      getBoundingSphere: null
    }
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





const gamepadCheckFrequency = 1000


export class VrControllers extends Group3DFacade {
  constructor(parent) {
    super(parent)
    this.onBeforeRender = this.onBeforeRender.bind(this)
  }

  onBeforeRender(renderer, scene, camera) {
    // Poll for changes to the set of usable gamepads every so often.
    const now = Date.now()
    if (now - (this._lastCheckTime || 0) > gamepadCheckFrequency) {
      this._checkGamepads()
      this._lastCheckTime = now
    }

    // Sync the VrControllers group container to the worldspace transform of the camera prior to headset
    // pose; this allows each controller to just maintain its own local pose transform
    this.threeObject.matrixWorld.compose(camera.position, camera.quaternion, camera.scale)
  }

  afterUpdate() {
    const controllerChildren = []

    const {gamepads} = this
    if (gamepads) {
      for (let i = 0, len = gamepads.length; i < len; i++) {
        //if (controllerChildren[0]) break
        controllerChildren.push({
          key: `tracked${i}`,
          facade: TrackedVrController,
          gamepad: gamepads[i]
        })
      }
    }

    // Add a fallback gaze controller
    if (!controllerChildren.length) {
      controllerChildren.push({
        key: 'gaze',
        facade: GazeVrController
      })
    }

    this.children = controllerChildren
    super.afterUpdate()
  }

  _checkGamepads() {
    let gamepads = null
    if (this.vrDisplay) {
      const allGamepads = navigator.getGamepads && navigator.getGamepads()
      if (allGamepads) {
        for (let i = 0, len = allGamepads.length; i < len; i++) {
          const gamepad = allGamepads[i]
          // Only include gamepads that match the active VRDisplay's id, and that are in use (have pose data).
          // Note: we don't use the `gamepad.connected` property as there's indication in other projects
          // that it is not accurate in some browsers, but we should verify that's still true.
          if (gamepad && gamepad.displayId === this.vrDisplay.displayId && gamepad.pose && gamepad.pose.orientation) {
            (gamepads || (gamepads = [])).push(gamepad)
          }
        }
      }
    }
    if (!arraysAreEqual(gamepads, this.gamepads)) {
      this.gamepads = gamepads
      this.afterUpdate()
    }
  }
}


