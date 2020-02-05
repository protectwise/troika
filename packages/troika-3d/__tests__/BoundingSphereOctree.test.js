import {Ray, Sphere, Vector3} from 'three'
import {BoundingSphereOctree} from '../src/BoundingSphereOctree.js'


let octree, skipTreeValidation

beforeEach(() => {
  skipTreeValidation = false
  octree = new BoundingSphereOctree()

  // Brute-force validation of tree state after every modification operation
  ;['putSphere', 'putSpheres', 'removeSphere'].forEach(methodName => {
    const method = octree[methodName]
    octree[methodName] = function() {
      method.apply(this, arguments)
      if (!skipTreeValidation) {
        validateOctreeState()
      }
    }
  })
})

afterEach(() => {
  // Brute-force validation of tree state at end of every test
  if (!skipTreeValidation) {
    validateOctreeState()
  }
})


describe('Single sphere', () => {
  let singleSphere

  beforeEach(() => {
    singleSphere = createSphere(0, 0, 0, 1)
    octree.putSphere('s0', singleSphere)
  })

  test('creates a single leaf node at the root', () => {
    expectObject(octree.root)
    expect(octree.root.isLeaf).toBe(true)
    expect(octree.root.data).toBe(singleSphere)
    expect(octree.root.dataKey).toBe('s0')
  })

  test('hits on an intersecting ray', () => {
    expectRayMatches(
      createRayFromPoints(0.5, 0.5, 10, 0.5, 0.5, -10),
      {s0: singleSphere}
    )
  })

  test('misses on a non-intersecting ray', () => {
    expectRayMatches(
      createRayFromPoints(0.5, 0.5, 10, 0.5, 0.5, 20),
      null
    )
  })
})


describe('Two coincident spheres', () => {
  let spheres

  beforeEach(() => {
    spheres = {
      sphere1: createSphere(0, 0, 0, 1),
      sphere2: createSphere(0, 0, 0, 2)
    }
    octree.putSpheres(spheres)
  })

  test('creates a single leaf node at the root with two data members', () => {
    expectObject(octree.root)
    expect(octree.root.isLeaf).toBe(true)
    expect(octree.root.data).not.toBeNull()
    expect(octree.root.dataKey).toBeNull()
    expect(octree.root.data.sphere1).toBe(spheres.sphere1)
    expect(octree.root.data.sphere2).toBe(spheres.sphere2)
  })

  test('hits both on an intersecting ray', () => {
    expectRayMatches(
      createRayFromPoints(0.5, 0, 10, 0.5, 0, -10),
      spheres
    )
  })

  test('hits one on a partially intersecting ray', () => {
    expectRayMatches(
      createRayFromPoints(1.5, 0, 10, 1.5, 0, -10),
      {sphere2: spheres.sphere2}
    )
  })

  test('misses on a non-intersecting ray', () => {
    expectRayMatches(
      createRayFromPoints(2.5, 0, 10, 2.5, 0, -10),
      null
    )
  })
})


describe('Two non-coincident non-overlapping spheres', () => {
  let spheres

  beforeEach(() => {
    spheres = {
      sphere1: createSphere(2, 0, 0, 1.1),
      sphere2: createSphere(-2, 0, 0, 0.9)
    }
    octree.putSpheres(spheres)
  })

  test('creates a branch node at the root with two leaf nodes', () => {
    const root = octree.root
    expectObject(root)
    expect(root.isLeaf).toBe(false)
    expect(root.maxRadius).toEqual(1.1)

    let subNodeCount = 0
    for (let i = 0; i < 8; i++) {
      if (root[i]) {
        expect(root[i].isLeaf).toBe(true)
        const data = root[i].data
        const dataKey = root[i].dataKey
        expect(data === spheres.sphere1 || data === spheres.sphere2).toBe(true)
        expect(dataKey === 'sphere1' || dataKey === 'sphere2').toBe(true)
        subNodeCount++
      }
    }
    expect(subNodeCount).toBe(2)
  })

  test('hits one on a partially intersecting ray', () => {
    expectRayMatches(
      createRayFromPoints(1.5, 0, 10, 1.5, 0, -10),
      {sphere1: spheres.sphere1}
    )
    expectRayMatches(
      createRayFromPoints(-1.5, 0, 10, -1.5, 0, -10),
      {sphere2: spheres.sphere2}
    )
  })

  test('hits both on an intersecting ray', () => {
    expectRayMatches(
      createRayFromPoints(10, 0, 0.5, -10, 0, 0.5),
      spheres
    )
  })

  test('misses on a non-intersecting ray', () => {
    expectRayMatches(
      createRayFromPoints(100, 0, 10, 100, 0, -10),
      null
    )
  })
})


describe('Two non-coincident overlapping spheres', () => {
  let spheres

  beforeEach(() => {
    spheres = {
      sphere1: createSphere(2, 0, 0, 3),
      sphere2: createSphere(-2, 0, 0, 4)
    }
    octree.putSpheres(spheres)
  })

  test('creates a branch node at the root with two leaf nodes', () => {
    const root = octree.root
    expectObject(root)
    expect(root.isLeaf).toBe(false)
    expect(root.maxRadius).toEqual(4)

    let subNodeCount = 0
    for (let i = 0; i < 8; i++) {
      if (root[i]) {
        expect(root[i].isLeaf).toBe(true)
        const data = root[i].data
        const dataKey = root[i].dataKey
        expect(data === spheres.sphere1 || data === spheres.sphere2).toBe(true)
        expect(dataKey === 'sphere1' || dataKey === 'sphere2').toBe(true)
        subNodeCount++
      }
    }
    expect(subNodeCount).toBe(2)
  })

  test('hits one on a partially intersecting ray', () => {
    expectRayMatches(
      createRayFromPoints(3, 0, 10, 3, 0, -10),
      {sphere1: spheres.sphere1}
    )
    expectRayMatches(
      createRayFromPoints(-3, 0, 10, -3, 0, -10),
      {sphere2: spheres.sphere2}
    )
  })

  test('hits both on an intersecting ray', () => {
    expectRayMatches(
      createRayFromPoints(0, 0, 10, 0, 0, -10),
      spheres
    )
  })

  test('misses on a non-intersecting ray', () => {
    expectRayMatches(
      createRayFromPoints(100, 0, 10, 100, 0, -10),
      null
    )
  })
})


describe('Tree expansion', () => {
  test('expands the root node to match a sphere outside its bounds', () => {
    const sphere1 = createSphere(0.5, 0, 0, 0.8)
    const sphere2 = createSphere(-0.5, 0, 0, 0.9)
    const sphere3 = createSphere(1.5, 0, 0, 1.1)
    const sphere4 = createSphere(-10, 0, 0, 1.2)

    octree.putSpheres({s1: sphere1, s2: sphere2})
    const rootSize1 = octree.root.cr

    octree.putSphere('s3', sphere3)
    const rootSize2 = octree.root.cr
    expect(rootSize2).toBeGreaterThan(rootSize1)

    octree.putSphere('s4', sphere4)
    const rootSize3 = octree.root.cr
    expect(rootSize3).toBeGreaterThan(rootSize2)
  })

  test('sets maxRadius correctly after expansion', () => {
    const sphere1 = createSphere(0.5, 0, 0, 0.8)
    const sphere2 = createSphere(-0.5, 0, 0, 0.9)
    const sphere3 = createSphere(1.5, 0, 0, 1.1)
    const sphere4 = createSphere(-10, 0, 0, 1.2)

    octree.putSpheres({s1: sphere1, s2: sphere2})
    expect(octree.root.maxRadius).toEqual(0.9)

    octree.putSphere('s3', sphere3)
    expect(octree.root.maxRadius).toEqual(1.1)

    octree.putSphere('s4', sphere4)
    expect(octree.root.maxRadius).toEqual(1.2)
  })

  test('hits ray tests after expansion', () => {
    const sphere1 = createSphere(0.5, 0, 0, 0.5)
    const sphere2 = createSphere(-0.5, 0, 0, 0.5)
    const sphere3 = createSphere(1.5, 0, 0, 0.5)
    octree.putSphere('sphere1', sphere1)
    octree.putSphere('sphere2', sphere2)
    octree.putSphere('sphere3', sphere3)

    expectRayMatches(
      createRayFromPoints(0.4, 0, 10, 0.4, 0, -10),
      {sphere1}
    )
    expectRayMatches(
      createRayFromPoints(-0.4, 0, 10, -0.4, 0, -10),
      {sphere2}
    )
    expectRayMatches(
      createRayFromPoints(1.6, 0, 10, 1.6, 0, -10),
      {sphere3}
    )
    expectRayMatches(
      createRayFromPoints(10, 0, 0.1, -10, 0, 0.1),
      {sphere1, sphere2, sphere3}
    )
    expectRayMatches(
      createRayFromPoints(100, 100, -100, 100, 100, 100),
      null
    )
  })
})


describe('Sphere addition', () => {
  test('adds to a leaf with coincident sphere', () => {
    const sphere1 = createSphere(0.5, 0.5, 0.5, 0.5)
    const sphere2 = createSphere(1.5, 1.5, 1.5, 0.6)
    const sphere3 = createSphere(0.5, 0.5, 0.5, 0.7)
    const sphere4 = createSphere(0.5, 0.5, 0.5, 0.8)

    octree.putSpheres({sphere1, sphere2})
    expect(octree.root[0] && octree.root[0].isLeaf).toBe(true)
    expect(octree.root[0].data).toBe(sphere1)

    octree.putSphere('sphere3', sphere3)
    expect(octree.root[0] && octree.root[0].isLeaf).toBe(true)
    expectObject(octree.root[0].data)
    expect(Object.keys(octree.root[0].data).length).toBe(2)
    expect(octree.root[0].data.sphere1).toBe(sphere1)
    expect(octree.root[0].data.sphere3).toBe(sphere3)
    expect(octree.root[0].dataKey).toBe(null)
    expect(octree.root[0].sphereCount).toEqual(2)
    expect(octree.root[0].leafCount).toEqual(1)
    expect(octree.root[0].maxRadius).toEqual(0.7)
    expect(octree.root.sphereCount).toEqual(3)
    expect(octree.root.leafCount).toEqual(2)
    expect(octree.root.maxRadius).toEqual(0.7)

    octree.putSphere('sphere4', sphere4)
    expect(octree.root[0] && octree.root[0].isLeaf).toBe(true)
    expectObject(octree.root[0].data)
    expect(Object.keys(octree.root[0].data).length).toBe(3)
    expect(octree.root[0].data.sphere1).toBe(sphere1)
    expect(octree.root[0].data.sphere3).toBe(sphere3)
    expect(octree.root[0].data.sphere4).toBe(sphere4)
    expect(octree.root[0].dataKey).toBeNull()
    expect(octree.root[0].sphereCount).toEqual(3)
    expect(octree.root[0].leafCount).toEqual(1)
    expect(octree.root[0].maxRadius).toEqual(0.8)
    expect(octree.root.sphereCount).toEqual(4)
    expect(octree.root.leafCount).toEqual(2)
    expect(octree.root.maxRadius).toEqual(0.8)
  })

  test('splits a leaf into a branch with two leaves', () => {
    const sphere1 = createSphere(0.5, 0.5, 0.5, 0.5)
    const sphere2 = createSphere(1.5, 1.5, 1.5, 0.6)
    const sphere3 = createSphere(0.25, 0.25, 0.25, 0.7)

    octree.putSpheres({sphere1, sphere2})
    expect(octree.root[0] && octree.root[0].isLeaf).toBe(true)
    expect(octree.root[0].data).toBe(sphere1)
    expect(octree.root[0].dataKey).toBe('sphere1')

    octree.putSphere('sphere3', sphere3)
    expect(octree.root[0] && octree.root[0].isLeaf).toBe(false)
    expect(octree.root[0][0] && octree.root[0][0].isLeaf).toBe(true)
    expect(octree.root[0][7] && octree.root[0][7].isLeaf).toBe(true)

    expect(octree.root[0][0].sphereCount).toEqual(1)
    expect(octree.root[0][0].leafCount).toEqual(1)
    expect(octree.root[0][0].maxRadius).toEqual(0.7)
    expect(octree.root[0][7].sphereCount).toEqual(1)
    expect(octree.root[0][7].leafCount).toEqual(1)
    expect(octree.root[0][7].maxRadius).toEqual(0.5)
    expect(octree.root[0].sphereCount).toEqual(2)
    expect(octree.root[0].leafCount).toEqual(2)
    expect(octree.root[0].maxRadius).toEqual(0.7)
    expect(octree.root.sphereCount).toEqual(3)
    expect(octree.root.leafCount).toEqual(3)
    expect(octree.root.maxRadius).toEqual(0.7)
  })

  test('hits ray tests on deep branches', () => {
    const sphere0 = createSphere(0, 0, 0, 0.1)
    const sphere1 = createSphere(256, 0, 0, 0.1)
    const sphere2 = createSphere(64, 0, 0, 0.1)
    const sphere3 = createSphere(16, 0, 0, 0.1)
    const sphere4 = createSphere(4, 0, 0, 0.1)
    const sphere5 = createSphere(1, 0, 0, 0.1)
    const allSpheres = {sphere0, sphere1, sphere2, sphere3, sphere4, sphere5}
    octree.putSpheres(allSpheres)

    expectRayMatches(createRayFromPoints(1, 0, 10, 1, 0, -10), {sphere5})
    expectRayMatches(createRayFromPoints(0, 0, 10, 0, 0, -10), {sphere0})
    expectRayMatches(createRayFromPoints(256, 0, 10, 256, 0, -10), {sphere1})
    expectRayMatches(createRayFromPoints(16, 0, 10, 16, 0, -10), {sphere3})
    expectRayMatches(createRayFromPoints(-10, 0, 0, 10, 0, 0), allSpheres)
  })
})


describe('Sphere deletion', () => {
  test('removes from leaf members if coincident', () => {
    const spheres = {
      s0: createSphere(0, 0, 0, 1),
      s1: createSphere(1, 0, 0, 1),
      s2: createSphere(2, 0, 0, 1),
      s3: createSphere(2, 0, 0, 2) //coincident
    }
    octree.putSpheres(spheres)
    const leaf = findLeafForSphere(spheres.s3)
    expect(leaf).not.toBeNull()
    expect(findLeafForSphere(spheres.s2)).toBe(leaf) //same leaf for both spheres
    octree.removeSphere('s3')
    expect(findLeafForSphere(spheres.s3)).toBeNull()
    expect(findLeafForSphere(spheres.s2)).not.toBeNull()
    expect(findLeafForSphere(spheres.s2).data).toBe(spheres.s2)
    expect(findLeafForSphere(spheres.s2).dataKey).toBe('s2')
  })

  test('removes the leaf if single member', () => {
    const spheres = {
      s0: createSphere(0, 0, 0, 1),
      s1: createSphere(1, 0, 0, 1),
      s2: createSphere(2, 0, 0, 1),
      s3: createSphere(3, 0, 0, 1)
    }
    octree.putSpheres(spheres)
    expect(findLeafForSphere(spheres.s3)).not.toBeNull()
    octree.removeSphere('s3')
    expect(findLeafForSphere(spheres.s3)).toBeNull()
  })

  test('collapses empty branches upward', () => {
    const spheres = {
      s0: createSphere(0, 0, 0, 0.1),
      s1: createSphere(256, 256, 256, 0.1),
      s2: createSphere(0.001, 0.001, 0.001, 0.1) //very close to sphere1 results in deep branch
    }
    octree.putSpheres(spheres)
    expect(octree.root[0]).not.toBeNull()
    expect(octree.root[0].isLeaf).toBe(false)
    octree.removeSphere('s2') //should make sphere1's leaf collapse up
    expect(octree.root[0].isLeaf).toBe(true)
  })

  test('converts root to leaf on second-to-last deletion', () => {
    const spheres = {
      s0: createSphere(0, 0, 0, 0.1),
      s1: createSphere(256, 0, 0, 0.1),
      s2: createSphere(64, 0, 0, 0.1),
    }
    octree.putSpheres(spheres)
    octree.removeSphere('s0')
    octree.removeSphere('s1')
    expect(octree.root).not.toBeNull()
    expect(octree.root.isLeaf).toBe(true)
    expect(octree.root.data).toBe(spheres.s2)
  })

  test('sets root to null on last deletion', () => {
    const spheres = {
      s0: createSphere(0, 0, 0, 0.1),
      s1: createSphere(256, 0, 0, 0.1),
      s2: createSphere(64, 0, 0, 0.1),
    }
    octree.putSpheres(spheres)
    Object.keys(spheres).forEach(octree.removeSphere, octree)
    expect(octree.root).toBeNull()
  })

  test('allows calling with a sphere key that is not in the tree', () => {
    octree.putSpheres({
      s0: createSphere(0, 0, 0, 1),
      s1: createSphere(1, 0, 0, 1),
      s2: createSphere(2, 0, 0, 1)
    })
    expect(() => {
      octree.removeSphere('InvalidKey')
    }).not.toThrow()
  })
})


describe('Sphere modification', () => {
  describe('where position does not change', () => {
    test('keeps the leaf in place', () => {
      const spheres = {
        s0: createSphere(0, 0, 0, 0.1),
        s1: createSphere(256, 0, 0, 0.1),
        s2: createSphere(64, 0, 0, 0.1)
      }
      octree.putSpheres(spheres)
      const leaf1 = findLeafForSphere(spheres.s2)
      expect(leaf1).not.toBeNull()
      spheres.s2.radius = 4
      octree.putSphere('s2', spheres.s2)
      const leaf2 = findLeafForSphere(spheres.s2)
      expect(leaf2).not.toBeNull()
      expect(leaf2).toBe(leaf1)
    })

    test('hits on newly intersecting ray', () => {
      const spheres = {
        s0: createSphere(0, 0, 0, 0.1),
        s1: createSphere(256, 0, 0, 0.1),
        s2: createSphere(64, 0, 0, 0.1)
      }
      const ray = createRayFromPoints(65, 0, 10, 65, 0, -10)
      octree.putSpheres(spheres)
      expectRayMatches(ray, null)
      spheres.s2.radius = 4
      octree.putSphere('s2', spheres.s2)
      expectRayMatches(ray, {s2: spheres.s2})
    })

    test('misses on newly non-intersecting ray', () => {
      const spheres = {
        s0: createSphere(0, 0, 0, 0.1),
        s1: createSphere(256, 0, 0, 0.1),
        s2: createSphere(64, 0, 0, 4)
      }
      const ray = createRayFromPoints(65, 0, 10, 65, 0, -10)
      octree.putSpheres(spheres)
      expectRayMatches(ray, {s2: spheres.s2})
      spheres.s2.radius = 0.1
      octree.putSphere('s2', spheres.s2)
      expectRayMatches(ray, null)
    })
  })

  describe('where position moves but is still within leaf bounds', () => {
    test('keeps the leaf in place if it was the only sphere', () => {
      const spheres = {
        s0: createSphere(0, 0, 0, 0.1),
        s1: createSphere(256, 0, 0, 0.1),
        s2: createSphere(64, 0, 0, 0.1)
      }
      octree.putSpheres(spheres)
      const leaf1 = findLeafForSphere(spheres.s2)
      expect(leaf1).not.toBeNull()
      spheres.s2.center.x = 64.001
      spheres.s2.radius = 4
      octree.putSphere('s2', spheres.s2)
      const leaf2 = findLeafForSphere(spheres.s2)
      expect(leaf2).not.toBeNull()
      expect(leaf2).toBe(leaf1)
    })

    test('splits the leaf if it had multiple coincident spheres', () => {
      const spheres = {
        s0: createSphere(0, 0, 0, 0.1),
        s1: createSphere(256, 0, 0, 0.1),
        s2: createSphere(64, 0, 0, 0.1),
        s3: createSphere(64, 0, 0, 0.2)
      }
      octree.putSpheres(spheres)
      const sphere2LeafA = findLeafForSphere(spheres.s2)
      const sphere3LeafA = findLeafForSphere(spheres.s3)
      expect(sphere2LeafA).not.toBeNull()
      expect(sphere2LeafA).toBe(sphere3LeafA)
      spheres.s3.center.x = 64.001 //keep close together so they share a parent
      spheres.s3.radius = 4
      octree.putSphere('s3', spheres.s3)
      const sphere2LeafB = findLeafForSphere(spheres.s2)
      const sphere3LeafB = findLeafForSphere(spheres.s3)
      expect(sphere3LeafB).not.toBeNull()
      expect(sphere2LeafB).toBe(sphere2LeafA) //old leaf should be pushed down
      expect(sphere3LeafB).not.toBe(sphere3LeafA)
      expect(sphere3LeafB.parent).toBe(sphere2LeafB.parent)
    })

    test('hits on newly intersecting ray', () => {
      const spheres = {
        s0: createSphere(0, 0, 0, 0.1),
        s1: createSphere(256, 0, 0, 0.1),
        s2: createSphere(64, 0, 0, 0.1),
        s3: createSphere(64, 0, 0, 0.2)
      }
      const ray = createRayFromPoints(67, 0, 10, 67, 0, -10)

      octree.putSpheres(spheres)
      expectRayMatches(ray, null)

      spheres.s3.center.x = 64.1 //keep close together so they share a parent
      spheres.s3.radius = 4
      octree.putSphere('s3', spheres.s3)

      expectRayMatches(ray, {s3: spheres.s3})
    })

    test('misses on newly non-intersecting ray', () => {
      const spheres = {
        s0: createSphere(0, 0, 0, 0.1),
        s1: createSphere(256, 0, 0, 0.1),
        s2: createSphere(64, 0, 0, 0.1),
        s3: createSphere(64, 0, 0, 4)
      }
      const ray = createRayFromPoints(67, 0, 10, 67, 0, -10)

      octree.putSpheres(spheres)
      expectRayMatches(ray, {s3: spheres.s3})

      spheres.s3.center.x = 64.1 //keep close together so they share a parent
      spheres.s3.radius = 0.01
      octree.putSphere('s3', spheres.s3)
      expectRayMatches(ray, null)
    })
  })

  describe('where position moves outside leaf bounds', () => {
    test('removes the leaf and re-inserts if it was the only sphere in the leaf', () => {
      const spheres = {
        s0: createSphere(0, 0, 0, 0.1),
        s1: createSphere(256, 0, 0, 0.1),
        s2: createSphere(64, 0, 0, 0.1)
      }
      octree.putSpheres(spheres)
      const leaf1 = findLeafForSphere(spheres.s2)
      expect(leaf1).not.toBeNull()
      spheres.s2.center.x = -1000
      spheres.s2.radius = 4
      octree.putSphere('s2', spheres.s2)
      const leaf2 = findLeafForSphere(spheres.s2)
      expect(leaf2).not.toBeNull()
      expect(leaf2).not.toBe(leaf1)
    })

    test('keeps the leaf, minus that sphere, and re-inserts if it was one of multiple spheres in the leaf', () => {
      const spheres = {
        s0: createSphere(0, 0, 0, 0.1),
        s1: createSphere(256, 0, 0, 0.1),
        s2: createSphere(64, 0, 0, 0.1),
        s3: createSphere(64, 0, 0, 0.2)
      }
      octree.putSpheres(spheres)
      const sphere2LeafA = findLeafForSphere(spheres.s2)
      const sphere3LeafA = findLeafForSphere(spheres.s3)
      expect(sphere2LeafA).not.toBeNull()
      expect(sphere2LeafA).toBe(sphere3LeafA)
      spheres.s3.center.x = -1000
      spheres.s3.radius = 4
      octree.putSphere('s3', spheres.s3)
      const sphere2LeafB = findLeafForSphere(spheres.s2)
      const sphere3LeafB = findLeafForSphere(spheres.s3)
      expect(sphere3LeafB).not.toBeNull()
      expect(sphere2LeafB).toBe(sphere2LeafA) //old leaf should remain
      expect(sphere2LeafB.data).toBe(spheres.s2)
      expect(sphere2LeafB.dataKey).toBe('s2')
      expect(sphere3LeafB).not.toBe(sphere3LeafA)
      expect(sphere3LeafB.parent).not.toBe(sphere2LeafB.parent)
    })
  })

  test('hits on newly intersecting ray', () => {
    const spheres = {
      s0: createSphere(0, 0, 0, 0.1),
      s1: createSphere(256, 0, 0, 0.1),
      s2: createSphere(64, 0, 0, 0.1)
    }
    const ray = createRayFromPoints(-1001, 0, 10, -1001, 0, -10)
    octree.putSpheres(spheres)
    expectRayMatches(ray, null)

    spheres.s2.center.x = -1000
    spheres.s2.radius = 4
    octree.putSphere('s2', spheres.s2)
    expectRayMatches(ray, {s2: spheres.s2})
  })

  test('misses on newly non-intersecting ray', () => {
    const spheres = {
      s0: createSphere(0, 0, 0, 0.1),
      s1: createSphere(256, 0, 0, 0.1),
      s2: createSphere(64, 0, 0, 4)
    }
    const ray = createRayFromPoints(63, 0, 10, 63, 0, -10)
    octree.putSpheres(spheres)
    expectRayMatches(ray, {s2: spheres.s2})

    spheres.s2.center.x = -1000
    spheres.s2.radius = 4
    octree.putSphere('s2', spheres.s2)
    expectRayMatches(ray, null)
  })
})


describe('Sphere collision search', () => {
  test('hits on intersecting spheres', () => {
    const spheres = {
      s0: createSphere(0, 0, 0, 1),
      s1: createSphere(1, 0, 0, 1),
      s2: createSphere(10, 0, 0, 1)
    }
    octree.putSpheres(spheres)

    let testSphere = createSphere(0.5, 0, 0, 0.1)
    expect(findSpheresTouchingSphere(testSphere)).toEqual({s0: spheres.s0, s1: spheres.s1})

    testSphere = createSphere(12, 0, 0, 3)
    expect(findSpheresTouchingSphere(testSphere)).toEqual({s2: spheres.s2})

    testSphere = createSphere(-10, 0, 0, 50)
    expect(findSpheresTouchingSphere(testSphere)).toEqual(spheres)
  })

  test('misses on non-intersecting spheres', () => {
    const spheres = {
      s0: createSphere(0, 0, 0, 1),
      s1: createSphere(1, 0, 0, 1),
      s2: createSphere(10, 0, 0, 1)
    }
    octree.putSpheres(spheres)

    let testSphere = createSphere(-100, 0, 0, 0.1)
    expect(findSpheresTouchingSphere(testSphere)).toEqual(null)
  })
})




describe.skip('Benchmarks', () => {
  let allSpheres
  let allSpheresCount

  function randomSphere() {
    return createSphere(randRound(100) - 50, randRound(100) - 50, randRound(100) - 50, 0.001 + rand(5))
  }

  function fillWithRandomSpheresTo(num) {
    while (allSpheresCount < num) {
      const key = `${Math.random()}.${Math.random()}`
      const s = randomSphere()
      octree.putSphere(key, s)
      allSpheres[key] = s
      allSpheresCount++
    }
  }

  beforeEach(() => {
    allSpheres = {}
    allSpheresCount = 0
    skipTreeValidation = true
  })

  test('sphere addition', () => {
    const messages = []
    function measure(count) {
      const startTime = performance.now()
      fillWithRandomSpheresTo(count)
      messages.push(`- Added up to ${count} in ${performance.now() - startTime}ms - ${octree.root.sphereCount} spheres in ${octree.root.leafCount} leaves`)
    }
    measure(10)
    measure(100)
    measure(1000)
    measure(10000)
    measure(100000)
    console.log(`Sphere addition performance stats:\n${messages.join('\n')}`)
  })

  test('ray intersection search', () => {
    const messages = []
    function measure(count) {
      fillWithRandomSpheresTo(count)
      const samples = 1000
      let totalTime = 0
      for (let i = 0; i < samples; i++) {
        let startTime = performance.now()
        const rayX = rand(100)
        const rayY = rand(100)
        findSpheresOnRay(createRayFromPoints(rayX, rayY, 1000, rayX, rayY, -1000))
        totalTime += performance.now() - startTime
      }
      messages.push(`- Searched octree of size ${allSpheresCount} in average of ${totalTime / samples}ms`)
    }

    measure(10)
    measure(100)
    measure(1000)
    measure(10000)
    measure(100000)
    console.log(`Ray intersection test performance stats:\n${messages.join('\n')}`)
  })

  test('sphere intersection search', () => {
    const messages = []
    function measure(count) {
      fillWithRandomSpheresTo(count)
      const samples = 1000
      let totalTime = 0
      for (let i = 0; i < samples; i++) {
        let startTime = performance.now()
        findSpheresTouchingSphere(randomSphere())
        totalTime += performance.now() - startTime
      }
      messages.push(`- Searched octree of size ${allSpheresCount} in average of ${totalTime / samples}ms`)
    }

    measure(10)
    measure(100)
    measure(1000)
    measure(10000)
    measure(100000)
    console.log(`Sphere intersection test performance stats:\n${messages.join('\n')}`)
  })

  test('sphere deletion', () => {
    const messages = []
    function measure(addCount, deleteCount) {
      fillWithRandomSpheresTo(addCount)
      expect(octree.root.sphereCount).toEqual(addCount)
      const toDelete = Object.keys(allSpheres).slice(0, deleteCount)
      toDelete.forEach(key => {
        delete allSpheres[key]
        allSpheresCount--
      })
      const startTime = performance.now()
      toDelete.forEach(octree.removeSphere, octree)
      expect(octree.root.sphereCount).toEqual(addCount - deleteCount)
      const duration = performance.now() - startTime
      messages.push(`- Deleted ${deleteCount} of ${addCount} in ${duration}ms (${duration / deleteCount}ms average)`)
    }
    measure(10, 1)
    measure(100, 10)
    measure(1000, 100)
    measure(10000, 1000)
    measure(100000, 10000)
    console.log(`Sphere deletion performance stats:\n${messages.join('\n')}`)
  })

  test('sphere modification (no movements)', () => {
    const messages = []
    function measure(addCount, modifyCount) {
      fillWithRandomSpheresTo(addCount)
      expect(octree.root.sphereCount).toEqual(addCount)
      const toModify = Object.keys(allSpheres).slice(0, modifyCount)
      const startTime = performance.now()
      toModify.forEach(key => {
        const sphere = allSpheres[key]
        sphere.radius *= (Math.random() - 0.5)
        octree.putSphere(key, sphere)
      })
      const duration = performance.now() - startTime
      messages.push(`- Updated ${modifyCount} of ${addCount} in ${duration}ms (${duration / modifyCount}ms average)`)
    }
    measure(10, 1)
    measure(100, 10)
    measure(1000, 100)
    measure(10000, 1000)
    measure(100000, 10000)
    console.log(`Sphere modification (no movements) performance stats:\n${messages.join('\n')}`)
  })

  test('sphere modification - small movements', () => {
    const messages = []
    function measure(addCount, modifyCount) {
      fillWithRandomSpheresTo(addCount)
      expect(octree.root.sphereCount).toEqual(addCount)
      const toModify = Object.keys(allSpheres).slice(0, modifyCount)
      const startTime = performance.now()
      toModify.forEach(key => {
        const sphere = allSpheres[key]
        sphere.center.x += (Math.random() - 0.5) * 0.000001
        sphere.center.y += (Math.random() - 0.5) * 0.000001
        sphere.center.z += (Math.random() - 0.5) * 0.000001
        sphere.radius *= (Math.random() - 0.5)
        octree.putSphere(key, sphere)
      })
      const duration = performance.now() - startTime
      messages.push(`- Updated ${modifyCount} of ${addCount} in ${duration}ms (${duration / modifyCount}ms average)`)
    }
    measure(10, 1)
    measure(100, 10)
    measure(1000, 100)
    measure(10000, 1000)
    measure(100000, 10000)
    console.log(`Sphere modification (small movements) performance stats:\n${messages.join('\n')}`)
  })

  test('sphere modification - big movements', () => {
    const messages = []
    function measure(addCount, modifyCount) {
      fillWithRandomSpheresTo(addCount)
      expect(octree.root.sphereCount).toEqual(addCount)
      const toModify = Object.keys(allSpheres).slice(0, modifyCount)
      const startTime = performance.now()
      toModify.forEach(key => {
        const sphere = allSpheres[key]
        sphere.center.x += (Math.random() - 0.5) * 100
        sphere.center.y += (Math.random() - 0.5) * 100
        sphere.center.z += (Math.random() - 0.5) * 100
        sphere.radius *= (Math.random() - 0.5)
        octree.putSphere(key, sphere)
      })
      const duration = performance.now() - startTime
      messages.push(`- Updated ${modifyCount} of ${addCount} in ${duration}ms (${duration / modifyCount}ms average)`)
    }
    measure(10, 1)
    measure(100, 10)
    measure(1000, 100)
    measure(10000, 1000)
    measure(100000, 10000)
    console.log(`Sphere modification (big movements) performance stats:\n${messages.join('\n')}`)
  })
})





/////===== Utility Functions =====/////

function rand(mult) {return (Math.random()) * mult}
function randRound(mult) {return Math.round(rand(mult))}

function createSphere(x, y, z, r) {
  return new Sphere(new Vector3(x, y, z), r)
}

function createRayFromPoints(x0, y0, z0, x1, y1, z1) {
  return new Ray(
    new Vector3(x0, y0, z0),
    new Vector3(x1 - x0, y1 - y0, z1 - z0).normalize()
  )
}

function findSpheresOnRay(ray) {
  let results = null
  octree.forEachSphereOnRay(ray, (sphere, key) => {
    results = results || {}
    expect(results[key]).toBeFalsy()
    results[key] = sphere
  })
  return results
}

function findSpheresTouchingSphere(sphere) {
  let results = null
  octree.forEachIntersectingSphere(sphere, (sphere2, key) => {
    results = results || {}
    expect(results[key]).toBeFalsy()
    results[key] = sphere2
  })
  return results
}

function findLeafForSphere(sphere) {
  let result = null
  octree.walkTree(octant => {
    if (octant.isLeaf) {
      let matchingLeaf = null
      octant.forEachLeafSphere((_sphere, _key) => {
        if (_sphere === sphere) {
          if (matchingLeaf) {
            throw new Error('Found leaf holding the same sphere twice in its `data` array, this is an invalid state.')
          }
          matchingLeaf = octant
        }
      })
      if (matchingLeaf) {
        if (result) {
          throw new Error('Found more than one leaf holding the sphere, this is an invalid state.')
        }
        result = matchingLeaf
      }
    }
  })
  return result
}

function expectRayMatches(ray, spheres) {
  const results = findSpheresOnRay(ray)
  expect(results).toEqual(spheres)
}

function expectObject(val) {
  expect(Object.prototype.toString.call(val)).toBe('[object Object]')
}

function calcOctreeBranchStats(root) {
  let sphereCount = 0
  let leafCount = 0
  let maxRadius = 0
  octree.walkBranch(root, octant => {
    if (octant.isLeaf) {
      leafCount++
      octant.forEachLeafSphere(sphere => {
        sphereCount++
        maxRadius = Math.max(maxRadius, sphere.radius)
      })
    }
  })
  return {sphereCount, leafCount, maxRadius}
}

// Brute-force validation of entire tree structure
function validateOctreeState() {
  //const startTime = performance.now()
  octree.walkTree(octant => {
    // Check parent/child relationships
    if (octant.parent) {
      expect(octant.index).toBeGreaterThanOrEqual(0)
      expect(octant.index).toBeLessThan(8)
      expect(octant.parent[octant.index]).toBe(octant)
    } else {
      expect(octant.index).toBe(-1)
    }

    // Check bounds
    if (octant.parent) {
      expect(Math.abs(octant.cx - octant.parent.cx)).toBe(octant.cr)
      expect(Math.abs(octant.cy - octant.parent.cy)).toBe(octant.cr)
      expect(Math.abs(octant.cz - octant.parent.cz)).toBe(octant.cr)
      expect(octant.cr).toBe(octant.parent.cr / 2)
    }

    // Check stats
    let {sphereCount, leafCount, maxRadius} = calcOctreeBranchStats(octant)
    expect(octant.sphereCount).toEqual(sphereCount)
    expect(octant.leafCount).toEqual(leafCount)
    expect(octant.maxRadius).toEqual(maxRadius)
    expect(sphereCount).toBeGreaterThan(0) //empty octant wasn't removed correctly
    expect(leafCount).toBeGreaterThan(0)
    expect(leafCount === 1 && !octant.isLeaf).toBe(false) //branch with only one leaf under it wasn't collapsed correctly

    // Check leaf data
    if (octant.isLeaf) {
      octant.forEachLeafSphere(sphere => {
        expect(sphere.center.x).toEqual(octant.dataX)
        expect(sphere.center.y).toEqual(octant.dataY)
        expect(sphere.center.z).toEqual(octant.dataZ)
      })
      if (sphereCount > 1) {
        expect(octant.dataKey).toBeNull()
        expectObject(octant.data)
      } else {
        expect(typeof octant.dataKey === 'string').toBe(true)
        expect(octant.data).toBeInstanceOf(Sphere)
      }
    } else {
      expect(octant.data).toBeNull()
      expect(octant.dataKey).toBeNull()
    }

    // Check flat index
    if (octant.isLeaf) {
      octant.forEachLeafSphere((sphere, key) => {
        expect(octree.keysToLeaves[key]).toBe(octant)
      })
    }
  })

  // Check for stray items in flat index
  if (octree.root) {
    expect(Object.keys(octree.keysToLeaves).length).toEqual(octree.root.sphereCount)
  }

  //console.log(`Tree validated in ${performance.now() - startTime}ms`)
}

function dumpOctree() {
  console.log(
    JSON.stringify(octree.root, function(key, val) {
      if (key === 'parent') {
        return undefined
      }
      if (val && val.setFromPoints) {
        return `Sphere<${val.center.x},${val.center.y},${val.center.z},${val.radius}>`
      }
      return val
    }, 2)
  )
}


