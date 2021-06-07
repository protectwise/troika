import { BufferAttribute, BufferGeometry } from 'three'
import getNormals from 'polyline-normals'

/*

This is a copy of https://github.com/mattdesl/three-line-2d/blob/c0da016db3fcf9e9a6ebef8063fd7e8334af0ace/index.js
that has been modified for compatibility with later Three.js versions. Original MIT license applies.

Changes:
- addAttribute -> setAttribute
- buffer attributes are fully replaced rather than replacing just their .array
- changed to a ES6 class

*/

var VERTS_PER_POINT = 2;

class Line2DGeometry extends BufferGeometry {
  constructor (path, opt) {
    super()

    if (Array.isArray(path)) {
      opt = opt || {}
    } else if (typeof path === 'object') {
      opt = path
      path = []
    }

    opt = opt || {}

    // this.setAttribute('position', new BufferAttribute(undefined, 3));
    // this.setAttribute('lineNormal', new BufferAttribute(undefined, 2));
    // this.setAttribute('lineMiter', new BufferAttribute(undefined, 1));
    // if (opt.distances) {
    //   this.setAttribute('lineDistance', new BufferAttribute(undefined, 1));
    // }
    // this.setIndex(new BufferAttribute(undefined, 1));

    this.update(path, opt.closed)
  }

  // Patch overwriting of BufferAttribute.array, which is no longer supported and causes errors:
  update (path, closed) {
    path = path || []
    var normals = getNormals(path, closed)

    if (closed) {
      path = path.slice()
      path.push(path[0])
      normals.push(normals[0])
    }

    var attrPosition = this.getAttribute('position')
    var attrNormal = this.getAttribute('lineNormal')
    var attrMiter = this.getAttribute('lineMiter')
    var attrDistance = this.getAttribute('lineDistance')
    var attrIndex = this.getIndex()

    if (!attrPosition ||
      (path.length !== attrPosition.count / VERTS_PER_POINT)) {
      var count = path.length * VERTS_PER_POINT
      var indexCount = Math.max(0, (path.length - 1) * 6)
      this.setAttribute('position', attrPosition = new BufferAttribute(new Float32Array(count * 3), 3))
      this.setAttribute('lineNormal', attrNormal = new BufferAttribute(new Float32Array(count * 2), 2))
      this.setAttribute('lineMiter', attrMiter = new BufferAttribute(new Float32Array(count), 1))
      this.setIndex(attrIndex = new BufferAttribute(new Uint16Array(indexCount), 1))

      if (attrDistance) {
        this.setAttribute('lineDistance', attrDistance = new BufferAttribute(new Float32Array(count), 1))
      }
    } else {
      attrPosition.needsUpdate = true
      attrNormal.needsUpdate = true
      attrMiter.needsUpdate = true
      attrIndex.needsUpdate = true
      if (attrDistance) {
        attrDistance.needsUpdate = true
      }
    }

    var index = 0
    var c = 0
    var dIndex = 0
    var indexArray = attrIndex.array

    path.forEach(function (point, pointIndex, list) {
      var i = index
      indexArray[c++] = i + 0
      indexArray[c++] = i + 1
      indexArray[c++] = i + 2
      indexArray[c++] = i + 2
      indexArray[c++] = i + 1
      indexArray[c++] = i + 3

      attrPosition.setXYZ(index++, point[0], point[1], 0)
      attrPosition.setXYZ(index++, point[0], point[1], 0)

      if (attrDistance) {
        var d = pointIndex / (list.length - 1)
        attrDistance.setX(dIndex++, d)
        attrDistance.setX(dIndex++, d)
      }
    })

    var nIndex = 0
    var mIndex = 0
    normals.forEach(function (n) {
      var norm = n[0]
      var miter = n[1]
      attrNormal.setXY(nIndex++, norm[0], norm[1])
      attrNormal.setXY(nIndex++, norm[0], norm[1])

      attrMiter.setX(mIndex++, -miter)
      attrMiter.setX(mIndex++, miter)
    })
  }
}

export default Line2DGeometry
