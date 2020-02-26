// import {
//   CylinderBufferGeometry,
//   Mesh,
//   MeshPhongMaterial
// } from 'three'
// import { Object3DFacade, Instanceable3DFacade } from 'troika-3d'
// import { extendAsPhysical } from 'troika-physics'

// const RADIUS = 1.2
// const HEIGHT = 1

// const geometry = new CylinderBufferGeometry(RADIUS, RADIUS, HEIGHT, 20)
// const material = new MeshPhongMaterial({
//   transparent: true,
//   opacity: 1.0,
//   color: 0xFFFFFF,
//   refractionRatio: 0.8
// })

// class Paddle extends Object3DFacade {
//   constructor (parent) {
//     const mesh = new Mesh(geometry, material.clone())

//     super(parent, mesh)
//   }

//   set color (c) {
//     this.threeObject.material.color.set(c)
//   }

//   set environmentMap (envMapTexture) {
//     this.threeObject.material.envMap = envMapTexture
//   }
// }

// export default extendAsPhysical(Paddle)

import {
  CylinderBufferGeometry,
  SphereBufferGeometry,
  Mesh,
  MeshPhongMaterial
} from 'three'
import { Object3DFacade, Group3DFacade } from 'troika-3d'
import { extendAsPhysical } from 'troika-physics'

const cyl = new CylinderBufferGeometry(1, 1, 1, 32)
const sph = new SphereBufferGeometry(1, 32, 32) //, 10, 10, 10)
const material = new MeshPhongMaterial({
  color: 0xaaaaaa,
  refractionRatio: 0.8
})

class Disk extends Object3DFacade {
  constructor (parent) {
    const ground = new Mesh(cyl, material)
    super(parent, ground)
  }
}

class Handle extends Object3DFacade {
  constructor (parent) {
    const ground = new Mesh(cyl, material)
    super(parent, ground)
  }
}

class HandleTop extends Object3DFacade {
  constructor (parent) {
    const ground = new Mesh(sph, material)
    super(parent, ground)
  }
}

const HANDLE_RATIO = 5

class Paddle extends Group3DFacade {
  afterUpdate () {
    if (!this._hasChildren) {
      this._hasChildren = true

      const diskHeight = this.height / 2.5

      this.children = [
        {
          key: 'disk',
          facade: Disk,
          x: 0,
          y: diskHeight / 2,
          z: 0,
          scaleX: this.radius / 2,
          scaleY: diskHeight,
          scaleZ: this.radius / 2,
          castShadow: true,
          receiveShadow: true,
          pointerEvents: true
        },
        {
          key: 'handle',
          facade: Handle,
          x: 0,
          y: this.height / 2,
          z: 0,
          scaleX: this.radius / HANDLE_RATIO,
          scaleY: this.height,
          scaleZ: this.radius / HANDLE_RATIO,
          castShadow: true,
          receiveShadow: true,
          pointerEvents: true
        },
        {
          key: 'handle_top',
          facade: HandleTop,
          x: 0,
          y: this.height,
          z: 0,
          scaleX: this.radius / HANDLE_RATIO,
          scaleY: this.radius / HANDLE_RATIO,
          scaleZ: this.radius / HANDLE_RATIO,
          castShadow: true,
          receiveShadow: true,
          pointerEvents: true
        }
      ]
    }

    super.afterUpdate()
  }
}

export default extendAsPhysical(Paddle)
