import { ExtrudeBufferGeometry, MeshLambertMaterial, Path, Shape } from 'three'
import { MeshFacade } from 'troika-3d'

const degreeToRad = Math.PI / 180

let getMarkerGeometry = function () {
  const radius = 0.15
  const innerRadius = 0.1
  const depth = 0.05
  const shape = new Shape()
  shape.moveTo(radius, -radius)
    .lineTo(radius, 0)
    .absellipse(0, 0, radius, radius, 0, 270 * degreeToRad, false, 0)
    .lineTo(radius, -radius)
  shape.holes = [
    new Path().moveTo(innerRadius, -innerRadius)
      .lineTo(0, -innerRadius)
      .absellipse(0, 0, innerRadius, innerRadius, 270 * degreeToRad, 0, true, 0)
      .lineTo(innerRadius, -innerRadius)
  ]

  const geom = new ExtrudeBufferGeometry(shape, {
    curveSegments: 64,
    depth,
    bevelEnabled: false
    // bevelSize: 0.01,
    // bevelThickness: 0.01,
    // bevelSegments: 1
  })
    .rotateX(Math.PI / 2)
    .rotateY(Math.PI / 4)
    .translate(0, depth, 0)

  getMarkerGeometry = () => geom
  return geom
}

export class GroundTarget extends MeshFacade {
  constructor (parent) {
    super(parent)
    this.geometry = getMarkerGeometry()
    this.material = new MeshLambertMaterial({
      transparent: true,
      opacity: 0.8
    })
    this.autoDisposeGeometry = true
  }
}
