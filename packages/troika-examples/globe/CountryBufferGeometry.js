import {BufferGeometry, BufferAttribute} from 'three'
import {voronoi} from 'd3-voronoi'




// Based off https://github.com/substack/point-in-polygon/blob/master/index.js
function isPointInPolygon2(x, y, polyCoords) {
  var inside = false
  for (var i = 0, j = polyCoords.length - 1; i < polyCoords.length; j = i++) {
    var xi = polyCoords[i][0], yi = polyCoords[i][1]
    var xj = polyCoords[j][0], yj = polyCoords[j][1]
    var intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function isTriangleInPoly(trianglePoints, polyPoints) {
  // Use any point that lies within the triangle
  let [x1, y1] = trianglePoints[0]
  let [x2, y2] = trianglePoints[1]
  let [x3, y3] = trianglePoints[2]
  let edgeX = x2 + (x3 - x2) / 2
  let edgeY = y2 + (y3 - y2) / 2
  return isPointInPolygon2(x1 + (edgeX - x1) / 2, y1 + (edgeY - y1) / 2, polyPoints)
}

const voronoiInstance = voronoi()

export default class CountryBufferGeometry extends BufferGeometry {
  /**
   *
   * @param {Array} coords in geojson `coordinates` format
   */
  setCoordinates(coords) {
    var xyPositions = []
    var indexes = []

    // General approach adapted from example at https://forum.processing.org/one/topic/drawing-countries-on-top-of-a-3d-sphere-from-set-of-boundaries.html
    let handleCoordsGroup = coordsGroup => {
      // Normalize the incoming multi-dimensional polygon arrays
      let [mainPoly, ...holePolys] = coordsGroup
      for (let i = 0, iLen = coordsGroup.length; i < iLen; i++) {
        for (let j = 0, jLen = coordsGroup[i].length; j < jLen; j++) {
          let xy = coordsGroup[i][j]
          xy._positionIndex = xyPositions.length / 2
          xyPositions.push(xy[0], xy[1])
        }
      }

      // Add extra points at regular spacing to prevent long edges that would cut down through the sphere
      let minX = Infinity, maxX = -Infinity, minY = minX, maxY = maxX
      for (let i = 0, len = mainPoly.length; i < len; i++) {
        if (mainPoly[i][0] < minX) minX = mainPoly[i][0]
        if (mainPoly[i][0] > maxX) maxX = mainPoly[i][0]
        if (mainPoly[i][1] < minY) minY = mainPoly[i][1]
        if (mainPoly[i][1] > maxY) maxY = mainPoly[i][1]
      }
      const step = 5
      let allPoints = mainPoly.concat(...holePolys)
      for (let y = minY; y <= maxY; y += step) {
        for (let x = minX; x <= maxX; x += step) {
          // slightly nudge positions to prevent voronoi from dropping some triangles
          let xx = x + Math.random() / 10, yy = y + Math.random() / 10
          if (isPointInPolygon2(xx, yy, mainPoly)) {
            let p = [xx, yy]
            p._positionIndex = xyPositions.length / 2
            allPoints.push(p)
            xyPositions.push(xx, yy)
          }
        }
      }

      // Compute Voronoi/Delaunay triangles, and discard those that fall outside the polygon
      let triangles = voronoiInstance.triangles(allPoints)
      for (let i = 0, len = triangles.length; i < len; i++) {
        if (isTriangleInPoly(triangles[i], mainPoly)) {
          if (!holePolys.some(holePoly => isTriangleInPoly(triangles[i], holePoly))) {
            indexes.push( //reverse the triangle direction
              triangles[i][0]._positionIndex,
              triangles[i][2]._positionIndex,
              triangles[i][1]._positionIndex
            )
          }
        }
      }
    }

    // Coords may be from a single 'Polygon' or a 'MultiPolygon', handle either
    if (typeof coords[0][0][0] === 'number') {
      handleCoordsGroup(coords)
    } else {
      coords.forEach(handleCoordsGroup)
    }

    // Project the lat/long coords to x/y/z on a r=1 sphere
    var radMult = Math.PI / 180
    var xyzPositions = new Float32Array(xyPositions.length / 2 * 3)
    var uvs = new Float32Array(xyPositions.length)
    for (let i = 0, len = xyPositions.length; i < len; i += 2) {
      let cosLon = Math.cos(-xyPositions[i] * radMult)
      let sinLon = Math.sin(-xyPositions[i] * radMult)
      let cosLat = Math.cos(xyPositions[i + 1] * radMult)
      let sinLat = Math.sin(xyPositions[i + 1] * radMult)
      let xyzIndex = i / 2 * 3
      xyzPositions[xyzIndex] = cosLat * cosLon //x
      xyzPositions[xyzIndex + 1] = sinLat //y
      xyzPositions[xyzIndex + 2] = cosLat * sinLon //z
      uvs[i] = (xyPositions[i] + 180) / 360 //u
      uvs[i + 1] = (xyPositions[i + 1] + 90) / 180 //v
    }

    // Init the buffer geometry with the projected vertices and triangulation indexes
    var positionAttr = new BufferAttribute(xyzPositions, 3)
    this.setAttribute('position', positionAttr)
    this.setAttribute('normal', positionAttr) //positions are based off r=1 so they can be used directly as normals
    this.setAttribute('uv', new BufferAttribute(uvs, 2))
    this.setIndex(new BufferAttribute(
      xyzPositions.length / 3 >> 16 === 0 ? new Uint16Array(indexes) :
      new Uint32Array(indexes)
    , 1))
  }
}
