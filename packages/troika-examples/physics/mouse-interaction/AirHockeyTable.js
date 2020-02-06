import {
  BoxGeometry,
  PlaneBufferGeometry,
  Mesh,
  MeshPhongMaterial,
  Vector3
} from 'three'
import { Object3DFacade, Group3DFacade } from 'troika-3d'
import { extendAsPhysical } from 'troika-physics'
import { CSG } from '@hi-level/three-csg'

const sx = 10
const sy = 1
const sz = 10

const floorgeom = new BoxGeometry(10, 1, 10) //, 10, 10, 10)
const wallgeom = new BoxGeometry(1, 3, 10) //, 10, 10, 10)
const planegeom = new PlaneBufferGeometry(15, 15) //, 10, 10, 10)
const material = new MeshPhongMaterial({
  transparent: true,
  opacity: 0.5,
  color: 0xFFFFFF,
  refractionRatio: 0.8
})

class Box extends Object3DFacade {
  constructor (parent) {
    const ground = new Mesh(floorgeom, material.clone())
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

class Wall extends Object3DFacade {
  constructor (parent) {
    const ground = new Mesh(wallgeom, material.clone())
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

class Unioned extends Object3DFacade {
  constructor(parent) {
    // Make 2 box meshes..
    const meshA = new Mesh(new BoxGeometry(5,1,10));
    const meshB = new Mesh(new BoxGeometry(2,10,1));
    
    // Offset one of the boxes by half its width..
    meshB.position.add(new Vector3(0.5, 0.5, 0.5))
    
    // Make sure the .matrix of each mesh is current
    meshA.updateMatrix();
    meshB.updateMatrix();
    
    // Create a bsp tree from each of the meshes
    const bspA = CSG.fromMesh(meshA);                        
    const bspB = CSG.fromMesh(meshB);
    
    // Subtract one bsp from the other via .subtract... other supported modes are .union and .intersect
    const bspResult = bspA.union(bspB);
    
    const obj = CSG.toMesh(bspResult, meshA.matrix)
    obj.material = material.clone()

    super(parent, obj)
  }
}

class AirHockeyTable extends Group3DFacade {
  constructor (parent) {
    super(parent)
  }

  // set opacity (o) {
  //   this.threeObject.material.opacity = o
  // }

  // set color (c) {
  //   this.threeObject.material.color.set(c)
  // }

  // set environmentMap (envMapTexture) {
  //   this.threeObject.material.envMap = envMapTexture
  // }

  afterUpdate () {    
    this.children = [
      {
        key: 'ground',
        facade: Box,
        x: 6,
        y: -2,
        z: 0,
        // x: -this.width / 2,
        // z: -this.length / 2,
        scaleX: 2, //this.width,
        // scaleY: 2,
        scaleZ: 2,
        // rotateX: -Math.PI / 6,
        color: 0xFF0000,
        castShadow: true,
        receiveShadow: true,
      },
      {
        key: 'ground2',
        facade: Box,
        x: -6,
        y: 0,
        z: 0,
        // x: -this.width / 2,
        // z: -this.length / 2,
        // scaleX: 2, //this.width,
        // scaleY: 2,
        // scaleZ: 2,
        // rotateX: -Math.PI / 2,
        color: 0x00FF00,
        castShadow: true,
        receiveShadow: true,
      },
      
      // {
      //   key: 'wall_left',
      //   facade: Wall,
      //   x: -5,
      //   // x: -this.width / 2,
      //   // scaleX: this.wallThickness,
      //   // scaleY: this.height,
      //   // scaleZ: this.length,
      //   color: 0x00FF00,
      //   castShadow: true,
      //   receiveShadow: true,
      // },
      // {
      //   key: 'wall_right',
      //   facade: Wall,
      //   x: 5,
      //   // x: this.width / 2,
      //   // scaleX: this.wallThickness,
      //   // scaleY: this.height,
      //   // scaleZ: this.length,
      //   color: 0x00FFFF,
      //   castShadow: true,
      //   receiveShadow: true,
      // },
      {
        key: 'union',
        facade: Unioned,
        color: 0x00FF00,
        castShadow: true,
        receiveShadow: true,
      }
    ]
    super.afterUpdate()
  }
}

// export default AirHockeyTable

export default extendAsPhysical(AirHockeyTable)
