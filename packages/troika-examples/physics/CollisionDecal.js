import {
  CircleBufferGeometry,
  Mesh,
  MeshPhongMaterial,
  MeshStandardMaterial,
  TextureLoader,
  Euler,
  Vector2,
  Vector3,
  Quaternion,
  Matrix4
} from 'three'
import { Object3DFacade } from 'troika-3d'
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry'
import { BoxBufferGeometry } from '../node_modules/three/src/Three'

const crackTextures = {
  large: new TextureLoader().load('physics/textures/cracks/broken-window-png-427.png')
}

const textureLoader = new TextureLoader()
const decalDiffuse = textureLoader.load('physics/textures/cracks/decal-diffuse.png')
const decalNormal = textureLoader.load('physics/textures/cracks/decal-normal.jpg')

const tempGeometry = new BoxBufferGeometry(1, 1, 1, 1, 1, 1, 1, 1)

const decalMaterial = new MeshPhongMaterial({
  specular: 0x444444,
  map: decalDiffuse,
  normalMap: decalNormal,
  // map: crackTextures.large,
  normalScale: new Vector2(1, 1),
  shininess: 30,
  transparent: true,
  depthTest: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  wireframe: false
})

export default class CollisionDecal extends Object3DFacade {
  constructor (parent) {
    const mesh = new Mesh(tempGeometry, decalMaterial.clone())
    super(parent, mesh)
  }

  set color (c) {
    this.threeObject.material.color.set(c)
  }

  afterUpdate () {
    super.afterUpdate()

    if (!this._hasDecal) {
      this._hasDecal = true
      const {
        targetXYZ,
        normalXYZ,
        scaledForce
      } = this.collision
      
      const collisionWorldPos = new Vector3().fromArray(targetXYZ)
      // const parentWorldPosition = this.parent.getWorldPosition()
      // const corrected = collisionWorldPos.clone().sub(parentWorldPosition)
      // console.log(`~~ wat`, collisionWorldPos, parentWorldPosition, ' ->', corrected)

      // // Use collisionNormal
      // // const myDirectionVector = new Vector3(this.normalX, this.normalY, this.normalZ)
      // const collisionPosition = new Vector3(target.x, target.y, target.z)
      const mx = new Matrix4().lookAt(
        new Vector3().fromArray(normalXYZ), // eye
        new Vector3(0, 0, 0), // center
        new Vector3(0, 1, 0) // up
      )
      const rot = new Euler().setFromRotationMatrix(mx)
      // console.log(`~~ rot?`, rot)
      // this.threeObject.updateMatrixWorld(true)

      // TODO It would be better to create the DecalGeometry in the constructor,
      // and just update its position attributes here. I'm unsure what else would
      // need to be updated though
      this.threeObject.geometry = new DecalGeometry(
        this.parent.threeObject, // Decals "wrap" the mesh they are applied to
        collisionWorldPos, // position
        rot,
        new Vector3(scaledForce, scaledForce, scaledForce) // size/scale
      )
      // this.threeObject.geometry.verticesNeedUpdate = true
      // this.threeObject.geometry.elementsNeedUpdate = true
      // this.threeObject.geometry.morphTargetsNeedUpdate = true
      // this.threeObject.geometry.uvsNeedUpdate = true
      // this.threeObject.geometry.normalsNeedUpdate = true
      // this.threeObject.geometry.colorsNeedUpdate = true
      // this.threeObject.geometry.tangentsNeedUpdate = true

      // this.threeObject.geometry.attributes.position.needsUpdate = true // required after the first render
      // this.threeObject.geometry.computeBoundingSphere()

      // this.threeObject.updateMatrixWorld(true)
    }
    // this._matrixChanged = true
    // super.afterUpdate()
  }
}
