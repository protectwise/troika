import { Object3DFacade, createDerivedMaterial } from 'troika-3d'
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereBufferGeometry,
  Vector3
} from 'three'
import geojson from './countries.geojson.json'


const lineSegmentPositions = []
const pushCoords = ([lon, lat]) => {
  // Project lat/long to x/y/z on a r=1 sphere
  const radMult = Math.PI / 180
  const cosLon = Math.cos(-lon * radMult)
  const sinLon = Math.sin(-lon * radMult)
  const cosLat = Math.cos(lat * radMult)
  const sinLat = Math.sin(lat * radMult)
  lineSegmentPositions.push(
    cosLat * cosLon, //x
    sinLat, //y
    cosLat * sinLon //z
  )
}

// Some lat/lng lines:
// for (let lat = -90; lat < 90; lat += 30) {
//   for (let lng = -180; lng < 180; lng += 30) {
//     for (let x = 0; x < 30; x += 5) {
//       pushCoords([lng, lat + x])
//       pushCoords([lng, lat + x + 5])
//     }
//     for (let x = 0; x < 30; x += 5) {
//       pushCoords([lng + x, lat])
//       pushCoords([lng + x + 5, lat])
//     }
//   }
// }

// Country borders:
Object.keys(geojson).forEach(region => {
  geojson[region].forEach(country => {
    const countryCoordData = country.geometry.coordinates

    const handleCoordsGroup = coordsGroup => {
      // Normalize the incoming multi-dimensional polygon arrays (main poly + holes --> coord pairs)
      for (let i = 0, iLen = coordsGroup.length; i < iLen; i++) {
        for (let j = 0, jLen = coordsGroup[i].length; j < jLen; j++) {
          pushCoords(coordsGroup[i][j === 0 ? jLen - 1 : j - 1])
          pushCoords(coordsGroup[i][j])
        }
      }
    }

    // Coords may be from a single 'Polygon' or a 'MultiPolygon', handle either
    if (typeof countryCoordData[0][0][0] === 'number') {
      handleCoordsGroup(countryCoordData)
    } else {
      countryCoordData.forEach(handleCoordsGroup)
    }
  })
})
const countryBordersGeometry = new BufferGeometry()
const positionAttr = new BufferAttribute(new Float32Array(lineSegmentPositions), 3)
countryBordersGeometry.setAttribute('position', positionAttr)
countryBordersGeometry.setAttribute('normal', positionAttr) //positions are based off r=1 so they can be used directly as normals

const sphereGeometry = new SphereBufferGeometry(1, 32, 24)
const sphereMaterial = createDerivedMaterial(new MeshBasicMaterial({
  color: 0x6666ff,
  transparent: true,
  opacity: 0.6,
  side: BackSide
}), {
  vertexDefs: 'varying vec3 vCameraSpaceNormal;',
  vertexMainIntro: `vCameraSpaceNormal = normalize((modelViewMatrix * vec4(normal, 0.0)).xyz);`,
  fragmentDefs: 'varying vec3 vCameraSpaceNormal;',
  fragmentColorTransform: `gl_FragColor.w = 0.15 + 0.5 * pow(length(cross(vCameraSpaceNormal, vec3(0.,0.,1.))), 8.0);`
})

class Globe extends Object3DFacade {
  constructor (parent) {
    const lines = new LineSegments(
      countryBordersGeometry,
      new MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x999999,
        roughness: 0.5,
        metalness: 0.5
      })
    )
    const sphere = new Mesh(
      sphereGeometry,
      sphereMaterial
    )
    sphere.add(lines)
    sphere.renderOrder = 1000 //make sure you can see things through it
    super(parent, sphere)

    this.raycastSide = DoubleSide
  }

  latLonToLocalPosition(lat, lon, radius = 1) {
    const angleMult = Math.PI / 180
    const cosLon = Math.cos(lon * angleMult)
    const sinLon = Math.sin(-lon * angleMult)
    const cosLat = Math.cos(lat * angleMult)
    const sinLat = Math.sin(lat * angleMult)
    return new Vector3(
      cosLat * cosLon * radius,
      sinLat * radius,
      cosLat * sinLon * radius
    )
  }

  latLonToWorldPosition(lat, lon, radius) {
    const pos = this.latLonToLocalPosition(lat, lon, radius)
    this.updateMatrices()
    pos.applyMatrix4(this.threeObject.matrixWorld)
    return pos
  }
}

export default Globe
