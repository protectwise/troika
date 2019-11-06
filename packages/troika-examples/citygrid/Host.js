import {BoxBufferGeometry, MeshLambertMaterial, Color, Mesh, BufferGeometry, BufferAttribute} from 'three'
import {Object3DFacade} from 'troika-3d'

/*
const hostGeometry = new BufferGeometry()
hostGeometry.setAttribute('position', new BufferAttribute(new Float32Array([
  0,0,0, 1,0,0, 1,0,1,
  0,0,0, 1,0,1, 0,0,1,

  0,1,0, 1,1,1, 1,1,0,
  0,1,0, 0,1,1, 1,1,1,

  0,0,0, 0,1,1, 0,1,0,
  0,0,0, 0,0,1, 0,1,1,

  1,0,0, 1,1,0, 1,1,1,
  1,0,0, 1,1,1, 1,0,1,

  0,0,1, 1,1,1, 0,1,1,
  0,0,1, 1,0,1, 1,1,1
].map((n, i) => (i + 1) % 3 ? n - 0.5 : n)), 3))
*/
const hostGeometry = new BoxBufferGeometry(1, 1, 1)
hostGeometry.translate(0, 0, .5)

const hostMaterials = {
  None: new MeshLambertMaterial({
    color: 0xcccccc,
    transparent: true,
    opacity: 0.6
  }),
  Low: new MeshLambertMaterial({
    color: 0xdbbb47
  }),
  Medium: new MeshLambertMaterial({
    color: 0xff8100
  }),
  High: new MeshLambertMaterial({
    color: 0xff0000
  })
}

const highlightMaterial = new MeshLambertMaterial({
  color: 0x3ba7db
})

const threatColors = {
  None: new Color(0xcccccc).getStyle(),
  Low: new Color(0xdbbb47).getStyle(),
  Medium: new Color(0xff8100).getStyle(),
  High: new Color(0xff0000).getStyle()
  // None: `rgb(${ 0xcc }, ${ 0xcc }, ${ 0xcc })`,
  // Low: `rgb(${ 0xdb }, ${ 0xbb }, ${ 0x47 })`,
  // Medium: `rgb(${ 0xff }, ${ 0x81 }, ${ 0x00 })`,
  // High: `rgb(${ 0xff }, ${ 0 }, ${ 0 })`
  // None: '#cccccc',
  // Low: '#dbbb47',
  // Medium: '#ff8100',
  // High: '#ff0000'
}


class Host extends Object3DFacade {
  constructor(parent) {
    let material = hostMaterials.None //.clone()

    let mesh = new Mesh(hostGeometry, material)
    mesh.renderOrder = 10 //prevent occlusion by translucent Zone walls

    super(parent, mesh)
  }

  set height(h) {
    this.scaleZ = h
  }
  get height() {
    return this.scaleZ
  }

  afterUpdate() {
    this.threeObject.material = this.highlight ? highlightMaterial : hostMaterials[this.threatLevel] || hostMaterials.None

    /* TODO animatable color/opacity - requires per-instance material which slows things down
    this.color = threatColors[this.threatLevel] || threatColors.None
    this.opacity = this.threatLevel ? 1 : 0.8
    */

    super.afterUpdate()
  }

  destructor() {
    super.destructor()
    // TODO dispose geometry/material?
  }
}

export default Host

