import {
  BoxGeometry,
  BoxBufferGeometry,
  Mesh,
  MeshPhongMaterial,
  MeshBasicMaterial,
  Color
} from 'three'
import { Object3DFacade, Group3DFacade, Instanceable3DFacade } from 'troika-3d'
import { extendAsPhysical } from 'troika-physics'

const floorGeometry = new BoxGeometry(1, 1, 1) //, 10, 10, 10)
const wallMaterial = new MeshPhongMaterial({
  transparent: true,
  opacity: 0.8,
  color: 0xFFFFFF,
  refractionRatio: 0.8
})

class Box extends Object3DFacade {
  constructor (parent) {
    const ground = new Mesh(floorGeometry, wallMaterial.clone())
    super(parent, ground)
  }

  set opacity (o) {
    this.threeObject.material.opacity = o
  }

  set color (c) {
    this.threeObject.material.color.set(c)
  }

  set environmentMap (envMapTexture) {
    this.threeObject.material.envMap = envMapTexture
  }
}

const wallBufferGeometry = new BoxBufferGeometry(1, 1, 1)
const wallMesh = new Mesh(wallBufferGeometry, wallMaterial)
wallMaterial.instanceUniforms = ['diffuse']

class Wall extends Instanceable3DFacade {
  constructor (parent) {
    super(parent)
    this.instancedThreeObject = wallMesh
  }

  set color (c) {
    if (!this._color !== c) {
      this.setInstanceUniform('diffuse', new Color(c))
    }
    this._color = c
  }
}

class _AirHockeyTable extends Group3DFacade {
  afterUpdate () {
    if (!this._hasChildren) {
      this._hasChildren = true
      const targetSize = this.width / 3 // Near/far wall divided into this for a center target

      this.children = [
        {
          key: 'ground',
          facade: Box,
          x: 0,
          y: -(this.wallThickness * 3) / 2,
          z: 0,
          scaleX: this.width,
          scaleY: this.wallThickness * 3,
          scaleZ: this.length,
          color: 0xFFFFFF,
          castShadow: true,
          receiveShadow: true
        },
        {
          key: 'wall_left',
          facade: Wall,
          x: -this.width / 2,
          y: this.height / 2,
          scaleX: this.wallThickness,
          scaleY: this.height,
          scaleZ: this.length,
          color: 0xEEEEEE,
          castShadow: true,
          receiveShadow: true
        },
        {
          key: 'wall_right',
          facade: Wall,
          x: this.width / 2,
          y: this.height / 2,
          scaleX: this.wallThickness,
          scaleY: this.height,
          scaleZ: this.length,
          color: 0xEEEEEE,
          castShadow: true,
          receiveShadow: true
        },
        {
          key: 'wall_near_right',
          facade: Wall,
          x: this.width / 2 - targetSize / 2,
          y: this.height / 2,
          z: this.length / 2,
          scaleX: targetSize,
          scaleY: this.height,
          scaleZ: this.wallThickness,
          color: 0xDDDDDD,
          castShadow: true,
          receiveShadow: true
        },
        {
          key: 'wall_near_left',
          facade: Wall,
          x: -this.width / 2 + targetSize / 2,
          y: this.height / 2,
          z: this.length / 2,
          scaleX: targetSize,
          scaleY: this.height,
          scaleZ: this.wallThickness,
          color: 0xDDDDDD,
          castShadow: true,
          receiveShadow: true
        },
        {
          key: 'wall_far_right',
          facade: Wall,
          x: this.width / 2 - targetSize / 2,
          y: this.height / 2,
          z: -this.length / 2,
          scaleX: targetSize,
          scaleY: this.height,
          scaleZ: this.wallThickness,
          color: 0xDDDDDD,
          castShadow: true,
          receiveShadow: true
        },
        {
          key: 'wall_far_left',
          facade: Wall,
          x: -this.width / 2 + targetSize / 2,
          y: this.height / 2,
          z: -this.length / 2,
          scaleX: targetSize,
          scaleY: this.height,
          scaleZ: this.wallThickness,
          color: 0xDDDDDD,
          castShadow: true,
          receiveShadow: true
        }
      ]
    }

    super.afterUpdate()
  }
}

export const AirHockeyTable = extendAsPhysical(_AirHockeyTable)

class _TableSurface extends Object3DFacade {
  constructor (parent) {
    const geometry = new BoxBufferGeometry(1, 1, 1, 1, 1, 1)
    const material = new MeshBasicMaterial({ color: 0xFF0000 })
    const mesh = new Mesh(geometry, material.clone())
    super(parent, mesh)
  }
}

export const TableSurface = extendAsPhysical(_TableSurface)