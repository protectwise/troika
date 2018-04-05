import Group3DFacade from '../Group3DFacade'
import Object3DFacade from '../Object3DFacade'
import Scene3DFacade from '../Scene3DFacade'
import { Matrix4, Mesh, MeshBasicMaterial, SphereBufferGeometry, Vector3 } from 'three'

const raycastFrequency = 16
const tempMat4 = new Matrix4()


export default class VrController extends Group3DFacade {

  constructor(parent) {
    super(parent)

    this.addEventListener('beforerender', this.onBeforeRender.bind(this))

    const scene = this._findScene()
    if (scene) {
      scene.addEventListener('mousemove', (this._onSceneMouseMove = this._onSceneMouseMove.bind(this)))
    }

    this.cursor = new PointerCursor(this)
  }

  _findScene() {
    let facade = this
    while (facade) {
      if (facade instanceof Scene3DFacade) {
        return facade
      }
      facade = facade.parent
    }
  }

  onBeforeRender(renderer, scene, camera) {
    // If it has a pointer ray, trigger a raycast
    // TODO verify onBeforeRender is the right time to do this???
    const now = Date.now()
    if (now - (this._lastRaycast || 0) > raycastFrequency) {
      const ray = this.getPointerRay() //may be null
      if (ray) {
        this.notifyWorld('pointerRayMotion', ray)
      }
      this._lastRaycast = now
    }
  }

  getPointerRay() {
    return null
  }

  /**
   * Handler invoked when this controller's pointer ray intersects with any object in the scene,
   * or the scene itself as a fallback. By default, it places a cursor object at the point of
   * intersection; can be overridden to add custom rendering behavior.
   * @param {Vector3|null} localIntersectionPoint
   */
  onPointerRayIntersectionChange(localIntersectionPoint) {
    // Update cursor to match hover state
    const cursor = this.cursor
    if (localIntersectionPoint) {
      cursor.visible = true
      cursor.x = localIntersectionPoint.x
      cursor.y = localIntersectionPoint.y
      cursor.z = localIntersectionPoint.z
      cursor.scale = 0.0025
    } else {
      cursor.visible = false
    }
    cursor.afterUpdate()
  }

  _onSceneMouseMove(e) {
    if (e.nativeEvent.raySource === this) {
      // Find point of intersection in local coordinates
      let localPoint = null
      const worldPoint = e.extra.point
      if (worldPoint) {
        localPoint = worldPoint.clone().applyMatrix4(tempMat4.getInverse(this.threeObject.matrixWorld))
      }
      this.onPointerRayIntersectionChange(localPoint)
    }
  }

  destructor() {
    const scene = this._findScene()
    if (scene) {
      scene.removeEventListener('mousemove', this._onSceneMouseMove)
    }
    this.cursor.destructor()
    super.destructor()
  }

}



const cursorGeom = new SphereBufferGeometry()
const cursorMtl = new MeshBasicMaterial({color: 0xffffff})
class PointerCursor extends Object3DFacade {
  constructor(parent) {
    super(parent, new Mesh(cursorGeom, cursorMtl))
  }
  afterUpdate() {
    // TODO: adjust scale to keep same visible size regardless of distance
    super.afterUpdate()
  }
}

