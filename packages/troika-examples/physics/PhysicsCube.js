import {
  BoxBufferGeometry,
  Mesh,
  MeshPhongMaterial
} from 'three'
import { extendAsPhysical } from 'troika-physics'
import { Object3DFacade } from 'troika-3d'

const DEFAULT_RADIUS = 1

const geometry = new BoxBufferGeometry(DEFAULT_RADIUS, DEFAULT_RADIUS, DEFAULT_RADIUS)
const material = new MeshPhongMaterial({
  transparent: true,
  opacity: 1.0
})
const physicsShape = {
  shape: 'box',
  ctrArgs: [{
    method: 'btVector3',
    args: [DEFAULT_RADIUS / 2, DEFAULT_RADIUS / 2, DEFAULT_RADIUS / 2]
  }]
  // shapeActions: [
  //   {
  //     method: 'setLocalScaling',
  //     args: [{
  //       method: 'btVector3',
  //       args: [randoRad, randoRad, randoRad]
  //     }]
  //   }
  // ]
}

class Cube extends Object3DFacade {
  constructor (parent) {
    const mesh = new Mesh(geometry, material.clone())
    super(parent, mesh)
    this._physicsShapeCfg = physicsShape
  }

  set radius (r) {
    // PhysicsObject3DFacade "watches" scaleX/Y/Z for
    // changes and forwards them to the PhysicsWorld
    // shape automatically
    this.scaleX = this.scaleY = this.scaleZ = r
    // if (r !== this._lastSetRad) {
    //   this._lastSetRad = r
    //   this.notifyWorld('updatePhysicsShape', {
    //     method: 'setLocalScaling',
    //     args: [{
    //       method: 'btVector3',
    //       args: [r, r, r]
    //     }]
    //   })
    // }
  }

  get radius () {
    return this.scaleZ
  }

  get color () {
    return this.threeObject.material.color.getHex()
  }

  set color (c) {
    this.threeObject.material.color.set(c)
  }

  set opacity (o) {
    this.threeObject.visible = o > 0
    this.threeObject.material.opacity = o
  }
}

export default extendAsPhysical(Cube)
