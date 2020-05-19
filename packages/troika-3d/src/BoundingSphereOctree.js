

/*

- Notify world when an Object3DFacade changes in a way that would affect its worldspace bounds or pickability:
  - added or removed from tree
  - change of its interceptsPointerEvents state (??? could be too expensive to check proactively)
  - world matrix version changes
  - change of the mesh's geometry object reference
  - change of the geometry's 'position' buffer attribute
  - custom?
- World collects a set of changed facades but doesn't act on them right away
- On the first raycasting request, if there are any changed facades collected, update the octree using the result of facade.getBoundingSphere()
- Use that octree for fast filtering to a small set of intersecting bounding boxes, then do true raycast on those

*/

import { Sphere } from 'three'
import { utils } from 'troika-core'

const { assign, forOwn } = utils
const tempSphere = new Sphere()
const SQRT3 = Math.sqrt(3)
const PRECISION = 1e-8


export class BoundingSphereOctree {
  constructor() {
    this.root = null
    this.keysToLeaves = Object.create(null)
  }

  putSpheres(spheres) {
    forOwn(spheres, (sphere, key) => {
      this.putSphere(key, sphere)
    })
  }

  putSphere(key, sphere) {
    const {center, radius} = sphere

    // Sanity check
    if (!sphere || isNaN(radius) || isNaN(center.x)) {
      console.warn('Invalid sphere', sphere)
      return
    }

    // To prevent excessively deep trees when spheres are very close together, apply a rounding
    // precision below which spheres will be treated as coincident and stored in the same leaf.
    center._roundedX = Math.round(center.x / PRECISION) * PRECISION
    center._roundedY = Math.round(center.y / PRECISION) * PRECISION
    center._roundedZ = Math.round(center.z / PRECISION) * PRECISION

    this._putSphere(key, sphere)
  }

  _putSphere(key, sphere) {
    const {center} = sphere
    const {root} = this
    let {_roundedX, _roundedY, _roundedZ} = center

    // If we already have a sphere for this key, perform an update
    if (key in this.keysToLeaves) {
      return this._updateSphere(key, sphere)
    }

    // First sphere being added: create a leaf octant and set it as the root. This will be replaced as
    // soon as a second item is added, so we can start with an initial root bounding cube that matches
    // our actual dataset rather than an arbitrary one.
    if (!root) {
      const newRoot = new Octant()
      newRoot.isLeaf = true
      newRoot.addSphereData(key, sphere)
      this.root = newRoot
      this.keysToLeaves[key] = newRoot
    }

    // Second sphere being added:
    else if (root.isLeaf) {
      const oldRoot = this.root
      const {dataX, dataY, dataZ} = root

      // Handle special case where the second sphere has the same center point as the first, we still
      // can't determine good starting bounds so just append to the existing leaf
      if (dataX === _roundedX && dataY === _roundedY && dataZ === _roundedZ) {
        this._insertIntoOctant(key, sphere, root)
      }
      // Non-coincident: we can now choose an appropriate size for the root node's box. Overwrite the
      // root with a new branch octant, and set its position/size to the smallest whole-integer cube
      // that contains both sphere centerpoints. (Cube rounded to whole ints to avoid floating point issues)
      else {
        const newRoot = new Octant()
        const cx = newRoot.cx = Math.round((dataX + _roundedX) / 2)
        const cy = newRoot.cy = Math.round((dataY + _roundedY) / 2)
        const cz = newRoot.cz = Math.round((dataZ + _roundedZ) / 2)
        newRoot.cr = Math.ceil(Math.max(Math.abs(cx - dataX), Math.abs(cy - dataY), Math.abs(cz - dataZ)) + 1e-5)
        this.root = newRoot

        // Re-add the original leaf's sphere(s) and the new sphere under the new branch root, and exit
        oldRoot.forEachLeafSphere((_sphere, _key) => this._insertIntoOctant(_key, _sphere, newRoot))
        this._insertIntoOctant(key, sphere, newRoot)
      }
    }

    // Expand the root to cover the new centerpoint if necessary, and insert the sphere within it
    else {
      this._expandToCoverPoint(_roundedX, _roundedY, _roundedZ)
      this._insertIntoOctant(key, sphere, this.root)
    }
  }

  _expandToCoverPoint(x, y, z) {
    // Loop until the root cube contains the new point...
    while (!this.root.containsPoint(x, y, z)) {
      // Create a larger branch, expanded by 2x in the corner direction closest to the new point
      const oldRoot = this.root
      const {cx, cy, cz, cr} = oldRoot
      const newRoot = new Octant()
      newRoot.maxRadius = oldRoot.maxRadius
      newRoot.sphereCount = oldRoot.sphereCount
      newRoot.leafCount = oldRoot.leafCount

      newRoot.cx = cx + cr * (x < cx ? -1 : 1)
      newRoot.cy = cy + cr * (y < cy ? -1 : 1)
      newRoot.cz = cz + cr * (z < cz ? -1 : 1)
      newRoot.cr = cr * 2

      // Move the old root to be a child of the new outer box, and make the outer box the new root
      const octantIdx = newRoot.getSubOctantIndexForPoint(cx, cy, cz)
      oldRoot.parent = newRoot
      oldRoot.index = octantIdx
      newRoot[octantIdx] = oldRoot
      this.root = newRoot
    }
  }

  _insertIntoOctant(key, sphere, octant) {
    const {center, radius} = sphere
    const {_roundedX, _roundedY, _roundedZ} = center

    // If the parent octant is a leaf:
    if (octant.isLeaf) {
      const {dataX, dataY, dataZ} = octant

      // If the new sphere's center matches that of the leaf, add it to the leaf's members
      if (_roundedX === dataX && _roundedY === dataY && _roundedZ === dataZ) {
        octant.addSphereData(key, sphere)

        // Increase maxRadius up the parent tree as needed
        for (let oct = octant.parent; oct; oct = oct.parent) {
          if (radius > oct.maxRadius) { oct.maxRadius = radius }
        }

        // Add to index
        this.keysToLeaves[key] =  octant
      }

      // Otherwise split the leaf into a branch, push the old leaf down, and try again
      else {
        const newBranch = _createBranchFromLeaf(octant)
        octant.parent[octant.index] = newBranch
        newBranch.addOctantForPoint(octant, dataX, dataY, dataZ)
        this._insertIntoOctant(key, sphere, newBranch) //recurse
      }
    }

    // The parent octant is a branch:
    else {
      // Always increment branch's total count
      octant.sphereCount++

      // Find the suboctant index in which the new center point falls
      const subOctantIndex = octant.getSubOctantIndexForPoint(_roundedX, _roundedY, _roundedZ)

      // If there is nothing at that index yet, insert a new leaf octant
      let subOctant = octant[subOctantIndex]
      if (!subOctant) {
        const newLeaf = new Octant()
        newLeaf.isLeaf = true
        octant.addOctantForPoint(newLeaf, _roundedX, _roundedY, _roundedZ)
        newLeaf.addSphereData(key, sphere)

        // Increment leafCount and maxRadius up the parent tree
        for (let oct = newLeaf.parent; oct; oct = oct.parent) {
          if (radius > oct.maxRadius) { oct.maxRadius = radius }
          oct.leafCount++
        }

        // Add to index
        this.keysToLeaves[key] = newLeaf
      }

      // If there was already a sub-octant at that index, recurse
      else {
        return this._insertIntoOctant(key, sphere, subOctant)
      }
    }
  }

  removeSphere(key) {
    // Find the existing leaf that holds the sphere
    let leafOctant = this.keysToLeaves[key]
    if (!leafOctant) { return }

    // Preemptively decrement sphereCount up the parent tree
    let oct = leafOctant.parent
    while (oct) {
      oct.sphereCount--
      oct = oct.parent
    }

    // If there are other members in the leaf, remove it from the leaf's members and keep the leaf in place
    if (leafOctant.sphereCount > 1) {
      // Remove sphere from the leaf data
      leafOctant.removeSphereData(key)

      // Update maxRadius up the tree
      leafOctant.updateMaxRadii()
    }

    // It was the only member of the leaf; remove the leaf and any ancestor branches that are now empty
    else {
      // Walk up the tree and remove all empty branches
      oct = leafOctant
      let lowestRemainingOctant
      do {
        const parent = oct.parent
        lowestRemainingOctant = parent
        if (parent) {
          parent[oct.index] = null
        }
        oct = oct.parent
      } while (oct && oct.sphereCount === 0)

      // If we got to the top of the tree, it's totally empty so set the root to null and exit
      if (!lowestRemainingOctant) {
        this.root = null
        return
      }

      // Continue up the tree, decrementing the leafCount and looking for the highest branch point with only
      // a single remaining leaf underneath it, if any
      let highestSingleLeafBranch = null
      oct = lowestRemainingOctant
      while (oct) {
        oct.leafCount--
        if (oct.leafCount === 1) {
          highestSingleLeafBranch = oct
        }
        oct = oct.parent
      }

      // If we were left with a branch with only one leaf descendant, move that leaf up to the branch point
      if (highestSingleLeafBranch) {
        let leaf = this._findSingleLeaf(highestSingleLeafBranch)
        const parent = highestSingleLeafBranch.parent
        if (parent) {
          parent.addOctantForPoint(leaf, leaf.cx, leaf.cy, leaf.cz)
          parent.updateMaxRadii()
        } else {
          this.root = leaf
        }
      } else {
        // Update the max radii up the tree from the lowest remaining node
        lowestRemainingOctant.updateMaxRadii()
      }
    }

    // Delete it from the index
    delete this.keysToLeaves[key]
  }

  _updateSphere(key, sphere) {
    // Find the existing leaf octant that holds the sphere
    let leaf = this.keysToLeaves[key]

    const center = sphere.center
    const {_roundedX, _roundedY, _roundedZ} = center

    // If its center point still falls within the leaf's cube, we can fast-path the changes:
    if (leaf.containsPoint(_roundedX, _roundedY, _roundedZ)) {
      const isMulti = leaf.sphereCount > 1

      const hasMoved = _roundedX !== leaf.dataX ||
        _roundedY !== leaf.dataY ||
        _roundedZ !== leaf.dataZ

      // If it was not the only member and has changed position, split that leaf; we can do this
      // slightly faster than a full remove+add because we know this will be the branch point and can
      // avoid some unnecessary upward tree walking
      if (isMulti && hasMoved) {
        leaf.removeSphereData(key)
        leaf.updateMaxRadii()
        this._insertIntoOctant(key, sphere, leaf)
      }

      // Otherwise we can just update this leaf
      else {
        if (hasMoved) {
          leaf.dataX = _roundedX
          leaf.dataY = _roundedY
          leaf.dataZ = _roundedZ
        }
        if (sphere.radius !== leaf.maxRadius) {
          leaf.updateMaxRadii()
        }
      }
    }

    // If its center point is no longer within the leaf, delegate to full remove+add
    // TODO possible faster path: remove only up to lowest common ancestor branch point,
    // collapse remaining up to that point, and insert sphere under that point
    else {
      this.removeSphere(key)
      this._putSphere(key, sphere)
    }
  }

  // Optimized utility for finding single descendant leaf without creating a function
  _findSingleLeaf(octant) {
    let leaf
    function visit(oct) {
      if (oct.isLeaf) leaf = oct
    }
    function find(oct) {
      leaf = null
      this.walkBranch(oct, visit)
      return leaf
    }
    this._findSingleLeaf = find //reuse closure after first call
    return find.call(this, octant)
  }


  /**
   * Perform a depth-first walk of the tree structure, invoking a `callback` function for
   * each node. The `callback` will be passed the current tree node object, and will be invoked
   * for parent branch nodes first before their child nodes.
   *
   * If the function returns `false` for a branch node, none of that branch's children will be
   * visited; this is how you can efficiently query the tree by filtering out the majority of branches.
   *
   * @param {Function} callback
   */
  walkTree(callback) {
    if (this.root) {
      this.walkBranch(this.root, callback)
    }
  }
  walkBranch(root, callback) {
    if (callback(root) !== false && !root.isLeaf) {
      for (let i = 0; i < 8; i++) {
        if (root[i] !== null) {
          this.walkBranch(root[i], callback)
        }
      }
    }
  }


  /**
   * Given a {@link Ray}, search the octree for any spheres that intersect that ray and invoke
   * the given `callback` function, passing it the sphere and its key as arguments.
   * TODO need to handle near/far
   *
   * @param {Ray} ray
   * @param {Function} callback
   * @param {Object} scope
   */
  forEachSphereOnRay(ray, callback, scope) {
    return this._forEachMatchingSphere(ray.intersectsSphere.bind(ray), callback, scope)
  }

  forEachIntersectingSphere(sphere, callback, scope) {
    return this._forEachMatchingSphere(sphere.intersectsSphere.bind(sphere), callback, scope)
  }

  _forEachMatchingSphere(testFn, callback, scope) {
    // const startTime = performance.now()
    // let branchTests = 0
    // let sphereTests = 0
    // let sphereHits = 0

    function visitSphere(sphere, key) {
      // sphereTests++
      if (testFn(sphere)) {
        // sphereHits++
        callback.call(scope, sphere, key)
      }
    }

    this.walkTree((octant) => {
      if (octant.isLeaf) { //leaf
        octant.forEachLeafSphere(visitSphere)
      } else { //branch
        // branchTests++
        // Test using a sphere large enough to cover the maximum constituent bounding sphere with
        // its center anywhere within the octant's box. This will obviously catch some false positives
        // but those will be filtered at the leaf level.
        // TODO investigate using a Box3 test, which could have fewer false positives, but only if that
        // outweighs its slower speed (see https://jsperf.com/ray-intersectsphere-vs-intersectbox)
        tempSphere.center.set(octant.cx, octant.cy, octant.cz)
        tempSphere.radius = octant.cr * SQRT3 + octant.maxRadius
        if (!testFn(tempSphere)) {
          return false //ignore this branch
        }
      }
      return true
    })

    //console.log(`Raycast search: ${branchTests} branch tests, ${sphereTests} sphere tests, and ${sphereHits} hits, in ${performance.now() - startTime}ms`)
  }
}




class Octant {
  containsPoint(x, y, z) {
    const {cx, cy, cz, cr} = this
    return x >= cx - cr && x < cx + cr &&
      y >= cy - cr && y < cy + cr &&
      z >= cz - cr && z < cz + cr
  }

  getSubOctantIndexForPoint(x, y, z) {
    return (z < this.cz ? 0 : 4) + (y < this.cy ? 0 : 2) + (x < this.cx ? 0 : 1)
  }

  addOctantForPoint(subOctant, x, y, z) {
    const index = this.getSubOctantIndexForPoint(x, y, z)
    const subCR = this.cr / 2

    subOctant.parent = this
    subOctant.index = index
    subOctant.cx = this.cx + subCR * (x < this.cx ? -1 : 1)
    subOctant.cy = this.cy + subCR * (y < this.cy ? -1 : 1)
    subOctant.cz = this.cz + subCR * (z < this.cz ? -1 : 1)
    subOctant.cr = subCR

    this[index] = subOctant
    return subOctant
  }

  findMaxSphereRadius() {
    let maxRadius = 0
    if (this.isLeaf) {
      const data = this.data
      if (this.sphereCount > 1) {
        for (let key in data) {
          const r = data[key].radius
          if (r > maxRadius) maxRadius = r
        }
      } else {
        maxRadius = data.radius
      }
    } else {
      for (let i = 0; i < 8; i++) {
        if (this[i] !== null && this[i].maxRadius > maxRadius) {
          maxRadius = this[i].maxRadius
        }
      }
    }
    return maxRadius
  }

  updateMaxRadii() {
    // Find the max maxRadius of the leaf octant's members
    let maxRadius = this.findMaxSphereRadius()

    // If the max radius has grown, just do a simple increase of the ancestor maxRadius values
    if (maxRadius > this.maxRadius) {
      let octant = this
      while (octant) {
        if (maxRadius > octant.maxRadius) {
          octant.maxRadius = maxRadius
        }
        octant = octant.parent
      }
    }
    // If the max radius has shrunk, set it and repeat the process up the parent tree
    else if (maxRadius < this.maxRadius) {
      this.maxRadius = maxRadius
      if (this.parent) {
        this.parent.updateMaxRadii()
      }
    }
  }

  addSphereData(key, sphere) {
    const count = this.sphereCount++
    if (count === 0) {
      this.leafCount = 1
      this.data = sphere
      this.dataKey = key
      // copy center coords from the first added sphere
      const {_roundedX, _roundedY, _roundedZ} = sphere.center
      this.dataX = _roundedX
      this.dataY = _roundedY
      this.dataZ = _roundedZ
    }
    else if (count === 1) {
      const oldSphere = this.data
      const newData = this.data = Object.create(null)
      newData[this.dataKey] = oldSphere
      newData[key] = sphere
      this.dataKey = null
    }
    else if (count > 1) {
      this.data[key] = sphere
    }

    if (sphere.radius > this.maxRadius) {
      this.maxRadius = sphere.radius
    }
  }

  removeSphereData(key) {
    const data = this.data
    if (data) {
      const count = this.sphereCount--
      if (count > 2) {
        delete data[key]
      }
      else if (count === 2) {
        for (let _key in data) {
          if (_key !== key) {
            this.dataKey = _key
            this.data = data[_key]
            break
          }
        }
      }
      else {
        this.data = null
      }
    }
  }

  forEachLeafSphere(fn, scope) {
    const data = this.data
    if (data) {
      if (this.sphereCount > 1) {
        for (let key in data) {
          fn.call(scope, data[key], key)
        }
      } else {
        fn.call(scope, data, this.dataKey)
      }
    }
  }
}
assign(Octant.prototype, {
  // Relationships
  parent: null,
  index: -1,

  // Cube bounds
  cx: 0, //center x
  cy: 0, //center y
  cz: 0, //center z
  cr: 0, //cubic radius (dist from center to edge)

  // Sub-octants
  0: null,
  1: null,
  2: null,
  3: null,
  4: null,
  5: null,
  6: null,
  7: null,

  // Leaf data
  // For a single-item leaf (probably the vast majority) `data` will be the Sphere object and `dataKey`
  // will be its key. For a multi-item leaf, `data` will be an object of key->Sphere mappings and
  // `dataKey` will be null. I'm not a huge fan of the asymmetry but this lets us avoid an extra
  // sub-object for the majority of leaves while keeping the Octant's shape predictable for the JS engine.
  isLeaf: false,
  data: null,
  dataKey: null,
  // The first sphere added to the leaf will have its center position copied for easier access and
  // to avoid issues with the Sphere objects being mutated elsewhere.
  dataX: 0,
  dataY: 0,
  dataZ: 0,

  // Stats
  sphereCount: 0,
  leafCount: 0,
  maxRadius: 0
})



const _createBranchFromLeaf = (function() {
  const copyProps = ['parent', 'index', 'cx', 'cy', 'cz', 'cr', 'sphereCount', 'leafCount', 'maxRadius']
  return function(leaf) {
    const branch = new Octant()
    for (let i = copyProps.length; i--;) {
      branch[copyProps[i]] = leaf[copyProps[i]]
    }
    return branch
  }
})()

