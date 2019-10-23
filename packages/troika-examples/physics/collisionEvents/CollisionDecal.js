import {
  Mesh,
  MeshPhongMaterial,
  BoxBufferGeometry,
  TextureLoader,
  Euler,
  Vector2,
  Vector3,
  Matrix4
} from 'three'
import { Object3DFacade } from 'troika-3d'
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry'

const textureLoader = new TextureLoader()
const decalDiffuse = textureLoader.load('physics/_shared/textures/cracks/decal-diffuse.png')
const decalNormal = textureLoader.load('physics/_shared/textures/cracks/decal-normal.jpg')

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
  wireframe: false,
  refractionRatio: 0.8
})

export default class CollisionDecal extends Object3DFacade {
  constructor (parent) {
    const mesh = new Mesh(tempGeometry, decalMaterial.clone())
    super(parent, mesh)
  }

  set color (c) {
    this.threeObject.material.color.set(c)
  }

  set environmentMap (envMapTexture) {
    this.threeObject.material.envMap = envMapTexture
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
      const mx = new Matrix4().lookAt(
        new Vector3().fromArray(normalXYZ), // eye
        new Vector3(0, 0, 0), // center
        new Vector3(0, 1, 0) // up
      )
      const rot = new Euler().setFromRotationMatrix(mx)

      // TODO It would be better to create the DecalGeometry in the constructor,
      // and just update its position attributes here. I'm unsure what else would
      // need to be updated though
      this.threeObject.geometry = new DecalGeometry(
        this.parent.threeObject, // Decals "wrap" the mesh they are applied to
        collisionWorldPos, // position
        rot,
        new Vector3(scaledForce, scaledForce, scaledForce) // size/scale
      )
    }
  }
}
