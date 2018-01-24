import {Ray, Sphere, Vector3} from 'three'
import {BoundingSphereOctree} from '../../../src/facade/threejs/BoundingSphereOctree'


let octree, skipTreeValidation

beforeEach(() => {
  skipTreeValidation = false
  octree = new BoundingSphereOctree()
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
    octree.addSphere(singleSphere)
  })

  test('creates a single leaf node at the root', () => {
    expect(octree.root).toBeInstanceOf(Object)
    expect(octree.root.isLeaf).toBe(true)
    expect(octree.root.data).toBe(singleSphere)
  })

  test('hits on an intersecting ray', () => {
    expectSpheresOnRay(
      createRayFromPoints(0.5, 0.5, 10, 0.5, 0.5, -10),
      [singleSphere]
    )
  })

  test('misses on a non-intersecting ray', () => {
    expectSpheresOnRay(
      createRayFromPoints(0.5, 0.5, 10, 0.5, 0.5, 20),
      []
    )
  })
})


describe('Two coincident spheres', () => {
  let sphere1, sphere2
  
  beforeEach(() => {
    sphere1 = createSphere(0, 0, 0, 1)
    sphere2 = createSphere(0, 0, 0, 2)
    octree.addSpheres([sphere1, sphere2])
  })

  test('creates a single leaf node at the root with two data members', () => {
    expect(octree.root).toBeInstanceOf(Object)
    expect(octree.root.isLeaf).toBe(true)
    expect(octree.root.data).toBeInstanceOf(Array)
    expect(octree.root.data[0]).toBe(sphere1)
    expect(octree.root.data[1]).toBe(sphere2)
  })

  test('hits both on an intersecting ray', () => {
    expectSpheresOnRay(
      createRayFromPoints(0.5, 0, 10, 0.5, 0, -10),
      [sphere1, sphere2]
    )
  })

  test('hits one on a partially intersecting ray', () => {
    expectSpheresOnRay(
      createRayFromPoints(1.5, 0, 10, 1.5, 0, -10),
      [sphere2]
    )
  })

  test('misses on a non-intersecting ray', () => {
    expectSpheresOnRay(
      createRayFromPoints(2.5, 0, 10, 2.5, 0, -10),
      []
    )
  })
})


describe('Two non-coincident non-overlapping spheres', () => {
  let sphere1, sphere2
  
  beforeEach(() => {
    sphere1 = createSphere(2, 0, 0, 1.1)
    sphere2 = createSphere(-2, 0, 0, 0.9)
    octree.addSpheres([sphere1, sphere2])
  })

  test('creates a branch node at the root with two leaf nodes', () => {
    const root = octree.root
    expect(root).toBeInstanceOf(Object)
    expect(root.isLeaf).toBe(false)
    expect(root.maxRadius).toEqual(1.1)

    let subNodeCount = 0
    for (let i = 0; i < 8; i++) {
      if (root[i]) {
        expect(root[i].isLeaf).toBe(true)
        const data = root[i].data
        expect(data === sphere1 || data === sphere2).toBe(true)
        subNodeCount++
      }
    }
    expect(subNodeCount).toBe(2)
  })

  test('hits one on a partially intersecting ray', () => {
    expectSpheresOnRay(
      createRayFromPoints(1.5, 0, 10, 1.5, 0, -10),
      [sphere1]
    )
    expectSpheresOnRay(
      createRayFromPoints(-1.5, 0, 10, -1.5, 0, -10),
      [sphere2]
    )
  })

  test('hits both on an intersecting ray', () => {
    expectSpheresOnRay(
      createRayFromPoints(10, 0, 0.5, -10, 0, 0.5),
      [sphere1, sphere2]
    )
  })
})


describe('Two non-coincident overlapping spheres', () => {
  let sphere1, sphere2

  beforeEach(() => {
    sphere1 = createSphere(2, 0, 0, 3)
    sphere2 = createSphere(-2, 0, 0, 4)
    octree.addSpheres([sphere1, sphere2])
  })

  test('creates a branch node at the root with two leaf nodes', () => {
    const root = octree.root
    expect(root).toBeInstanceOf(Object)
    expect(root.isLeaf).toBe(false)
    expect(root.maxRadius).toEqual(4)

    let subNodeCount = 0
    for (let i = 0; i < 8; i++) {
      if (root[i]) {
        expect(root[i].isLeaf).toBe(true)
        const data = root[i].data
        expect(data === sphere1 || data === sphere2).toBe(true)
        subNodeCount++
      }
    }
    expect(subNodeCount).toBe(2)
  })

  test('hits one on a partially intersecting ray', () => {
    expectSpheresOnRay(
      createRayFromPoints(3, 0, 10, 3, 0, -10),
      [sphere1]
    )
    expectSpheresOnRay(
      createRayFromPoints(-3, 0, 10, -3, 0, -10),
      [sphere2]
    )
  })

  test('hits both on an intersecting ray', () => {
    expectSpheresOnRay(
      createRayFromPoints(0, 0, 10, 0, 0, -10),
      [sphere1, sphere2]
    )
  })
})


describe('Tree expansion', () => {
  test('expands the root node to match a sphere outside its bounds', () => {
    const sphere1 = createSphere(0.5, 0, 0, 0.8)
    const sphere2 = createSphere(-0.5, 0, 0, 0.9)
    const sphere3 = createSphere(1.5, 0, 0, 1.1)
    const sphere4 = createSphere(-10, 0, 0, 1.2)

    octree.addSpheres([sphere1, sphere2])
    const rootSize1 = octree.root.cr

    octree.addSphere(sphere3)
    const rootSize2 = octree.root.cr
    expect(rootSize2).toBeGreaterThan(rootSize1)

    octree.addSphere(sphere4)
    const rootSize3 = octree.root.cr
    expect(rootSize3).toBeGreaterThan(rootSize2)
  })
  
  test('sets maxRadius correctly after expansion', () => {
    const sphere1 = createSphere(0.5, 0, 0, 0.8)
    const sphere2 = createSphere(-0.5, 0, 0, 0.9)
    const sphere3 = createSphere(1.5, 0, 0, 1.1)
    const sphere4 = createSphere(-10, 0, 0, 1.2)

    octree.addSpheres([sphere1, sphere2])
    expect(octree.root.maxRadius).toEqual(0.9)

    octree.addSphere(sphere3)
    expect(octree.root.maxRadius).toEqual(1.1)

    octree.addSphere(sphere4)
    expect(octree.root.maxRadius).toEqual(1.2)
  })

  test('hits ray tests after expansion', () => {
    const sphere1 = createSphere(0.5, 0, 0, 0.5)
    const sphere2 = createSphere(-0.5, 0, 0, 0.5)
    const sphere3 = createSphere(1.5, 0, 0, 0.5)
    octree.addSphere(sphere1)
    octree.addSphere(sphere2)
    octree.addSphere(sphere3)

    expectSpheresOnRay(
      createRayFromPoints(0.4, 0, 10, 0.4, 0, -10),
      [sphere1]
    )
    expectSpheresOnRay(
      createRayFromPoints(-0.4, 0, 10, -0.4, 0, -10),
      [sphere2]
    )
    expectSpheresOnRay(
      createRayFromPoints(1.6, 0, 10, 1.6, 0, -10),
      [sphere3]
    )
    expectSpheresOnRay(
      createRayFromPoints(10, 0, 0.1, -10, 0, 0.1),
      [sphere1, sphere2, sphere3]
    )
    expectSpheresOnRay(
      createRayFromPoints(100, 100, -100, 100, 100, 100),
      []
    )
  })
})


describe('Sphere insertion', () => {
  test('adds to a leaf with coincident sphere', () => {
    const sphere1 = createSphere(0.5, 0.5, 0.5, 0.5)
    const sphere2 = createSphere(1.5, 1.5, 1.5, 0.6)
    const sphere3 = createSphere(0.5, 0.5, 0.5, 0.7)
    const sphere4 = createSphere(0.5, 0.5, 0.5, 0.8)

    octree.addSpheres([sphere1, sphere2])
    expect(octree.root[0] && octree.root[0].isLeaf).toBe(true)
    expect(octree.root[0].data).toBe(sphere1)

    octree.addSphere(sphere3)
    expect(octree.root[0] && octree.root[0].isLeaf).toBe(true)
    expect(octree.root[0].data).toBeInstanceOf(Array)
    expect(octree.root[0].data.length).toBe(2)
    expect(octree.root[0].data[0]).toBe(sphere1)
    expect(octree.root[0].data[1]).toBe(sphere3)
    expect(octree.root[0].totalCount).toEqual(2)
    expect(octree.root[0].leafCount).toEqual(1)
    expect(octree.root[0].maxRadius).toEqual(0.7)
    expect(octree.root.totalCount).toEqual(3)
    expect(octree.root.leafCount).toEqual(2)
    expect(octree.root.maxRadius).toEqual(0.7)

    octree.addSphere(sphere4)
    expect(octree.root[0] && octree.root[0].isLeaf).toBe(true)
    expect(octree.root[0].data).toBeInstanceOf(Array)
    expect(octree.root[0].data.length).toBe(3)
    expect(octree.root[0].data[0]).toBe(sphere1)
    expect(octree.root[0].data[1]).toBe(sphere3)
    expect(octree.root[0].data[2]).toBe(sphere4)
    expect(octree.root[0].totalCount).toEqual(3)
    expect(octree.root[0].leafCount).toEqual(1)
    expect(octree.root[0].maxRadius).toEqual(0.8)
    expect(octree.root.totalCount).toEqual(4)
    expect(octree.root.leafCount).toEqual(2)
    expect(octree.root.maxRadius).toEqual(0.8)
  })

  test('splits a leaf into a branch with two leaves', () => {
    const sphere1 = createSphere(0.5, 0.5, 0.5, 0.5)
    const sphere2 = createSphere(1.5, 1.5, 1.5, 0.6)
    const sphere3 = createSphere(0.25, 0.25, 0.25, 0.7)

    octree.addSpheres([sphere1, sphere2])
    expect(octree.root[0] && octree.root[0].isLeaf).toBe(true)
    expect(octree.root[0].data).toBe(sphere1)

    octree.addSphere(sphere3)
    expect(octree.root[0] && octree.root[0].isLeaf).toBe(false)
    expect(octree.root[0][0] && octree.root[0][0].isLeaf).toBe(true)
    expect(octree.root[0][7] && octree.root[0][7].isLeaf).toBe(true)

    expect(octree.root[0][0].totalCount).toEqual(1)
    expect(octree.root[0][0].leafCount).toEqual(1)
    expect(octree.root[0][0].maxRadius).toEqual(0.7)
    expect(octree.root[0][7].totalCount).toEqual(1)
    expect(octree.root[0][7].leafCount).toEqual(1)
    expect(octree.root[0][7].maxRadius).toEqual(0.5)
    expect(octree.root[0].totalCount).toEqual(2)
    expect(octree.root[0].leafCount).toEqual(2)
    expect(octree.root[0].maxRadius).toEqual(0.7)
    expect(octree.root.totalCount).toEqual(3)
    expect(octree.root.leafCount).toEqual(3)
    expect(octree.root.maxRadius).toEqual(0.7)
  })

  test('hits ray tests on deep branches', () => {
    const spheres = [
      createSphere(0, 0, 0, 0.1),
      createSphere(256, 0, 0, 0.1),
      createSphere(64, 0, 0, 0.1),
      createSphere(16, 0, 0, 0.1),
      createSphere(4, 0, 0, 0.1),
      createSphere(1, 0, 0, 0.1)
    ]
    octree.addSpheres(spheres)

    expectSpheresOnRay(createRayFromPoints(1, 0, 10, 1, 0, -10), [spheres[5]])
    expectSpheresOnRay(createRayFromPoints(0, 0, 10, 0, 0, -10), [spheres[0]])
    expectSpheresOnRay(createRayFromPoints(256, 0, 10, 256, 0, -10), [spheres[1]])
    expectSpheresOnRay(createRayFromPoints(16, 0, 10, 16, 0, -10), [spheres[3]])
    expectSpheresOnRay(createRayFromPoints(-10, 0, 0, 10, 0, 0), spheres)
  })
})


describe('Sphere deletion', () => {
  test('removes from leaf members if coincident', () => {
    const spheres = [
      createSphere(0, 0, 0, 1),
      createSphere(1, 0, 0, 1),
      createSphere(2, 0, 0, 1),
      createSphere(2, 0, 0, 2) //coincident
    ]
    octree.addSpheres(spheres)
    const leaf = findLeafForSphere(spheres[3])
    expect(leaf).not.toBeNull()
    expect(findLeafForSphere(spheres[2])).toBe(leaf) //same leaf for both spheres
    octree.removeSphere(spheres[3])
    expect(findLeafForSphere(spheres[3])).toBeNull()
    expect(findLeafForSphere(spheres[2])).not.toBeNull()
    expect(findLeafForSphere(spheres[2]).data).toBe(spheres[2])
  })

  test('removes the leaf if single member', () => {
    const spheres = [
      createSphere(0, 0, 0, 1),
      createSphere(1, 0, 0, 1),
      createSphere(2, 0, 0, 1),
      createSphere(3, 0, 0, 1)
    ]
    octree.addSpheres(spheres)
    expect(findLeafForSphere(spheres[3])).not.toBeNull()
    octree.removeSphere(spheres[3])
    expect(findLeafForSphere(spheres[3])).toBeNull()
  })

  test('collapses empty branches upward', () => {
    const spheres = [
      createSphere(0, 0, 0, 0.1),
      createSphere(256, 256, 256, 0.1),
      createSphere(0.001, 0.001, 0.001, 0.1) //very close to sphere1 results in deep branch
    ]
    octree.addSpheres(spheres)
    expect(octree.root[0]).not.toBeNull()
    expect(octree.root[0].isLeaf).toBe(false)
    octree.removeSphere(spheres[2]) //should make sphere1's leaf collapse up
    expect(octree.root[0].isLeaf).toBe(true)
  })

  test('converts root to leaf on second-to-last deletion', () => {
    const spheres = [
      createSphere(0, 0, 0, 0.1),
      createSphere(256, 0, 0, 0.1),
      createSphere(64, 0, 0, 0.1),
    ]
    octree.addSpheres(spheres)
    octree.removeSphere(spheres[0])
    octree.removeSphere(spheres[1])
    expect(octree.root).not.toBeNull()
    expect(octree.root.isLeaf).toBe(true)
    expect(octree.root.data).toBe(spheres[2])
  })

  test('sets root to null on last deletion', () => {
    const spheres = [
      createSphere(0, 0, 0, 0.1),
      createSphere(256, 0, 0, 0.1),
      createSphere(64, 0, 0, 0.1),
    ]
    octree.addSpheres(spheres)
    spheres.forEach(octree.removeSphere, octree)
    expect(octree.root).toBeNull()
  })

  test('allows calling with a sphere that is not in the tree', () => {
    octree.addSpheres([
      createSphere(0, 0, 0, 1),
      createSphere(1, 0, 0, 1),
      createSphere(2, 0, 0, 1)
    ])
    expect(() => {
      octree.removeSphere(createSphere(3, 3, 3, 3))
    }).not.toThrow()
  })
})


describe('Sphere modification', () => {
  describe('where position does not change', () => {
    test('keeps the leaf in place', () => {
      const spheres = [
        createSphere(0, 0, 0, 0.1),
        createSphere(256, 0, 0, 0.1),
        createSphere(64, 0, 0, 0.1),
      ]
      octree.addSpheres(spheres)
      const leaf1 = findLeafForSphere(spheres[2])
      expect(leaf1).not.toBeNull()
      spheres[2].radius = 4
      octree.updateSphere(spheres[2])
      const leaf2 = findLeafForSphere(spheres[2])
      expect(leaf2).not.toBeNull()
      expect(leaf2).toBe(leaf1)
    })
  })

  describe('where position moves but is still within leaf bounds', () => {
    test('keeps the leaf in place if it was the only sphere', () => {
      const spheres = [
        createSphere(0, 0, 0, 0.1),
        createSphere(256, 0, 0, 0.1),
        createSphere(64, 0, 0, 0.1),
      ]
      octree.addSpheres(spheres)
      const leaf1 = findLeafForSphere(spheres[2])
      expect(leaf1).not.toBeNull()
      spheres[2].center.x = 64.001
      spheres[2].radius = 4
      octree.updateSphere(spheres[2])
      const leaf2 = findLeafForSphere(spheres[2])
      expect(leaf2).not.toBeNull()
      expect(leaf2).toBe(leaf1)
    })

    test('splits the leaf if it had multiple coincident spheres', () => {
      const spheres = [
        createSphere(0, 0, 0, 0.1),
        createSphere(256, 0, 0, 0.1),
        createSphere(64, 0, 0, 0.1),
        createSphere(64, 0, 0, 0.2)
      ]
      octree.addSpheres(spheres)
      const sphere2LeafA = findLeafForSphere(spheres[2])
      const sphere3LeafA = findLeafForSphere(spheres[3])
      expect(sphere2LeafA).not.toBeNull()
      expect(sphere2LeafA).toBe(sphere3LeafA)
      spheres[3].center.x = 64.001 //keep close together so they share a parent
      spheres[3].radius = 4
      octree.updateSphere(spheres[3])
      const sphere2LeafB = findLeafForSphere(spheres[2])
      const sphere3LeafB = findLeafForSphere(spheres[3])
      expect(sphere3LeafB).not.toBeNull()
      expect(sphere2LeafB).toBe(sphere2LeafA) //old leaf should be pushed down
      expect(sphere3LeafB).not.toBe(sphere3LeafA)
      expect(sphere3LeafB.parent).toBe(sphere2LeafB.parent)
    })
  })

  describe('where position moves outside leaf bounds', () => {
    test('removes the leaf and re-inserts if it was the only sphere in the leaf', () => {
      const spheres = [
        createSphere(0, 0, 0, 0.1),
        createSphere(256, 0, 0, 0.1),
        createSphere(64, 0, 0, 0.1),
      ]
      octree.addSpheres(spheres)
      const leaf1 = findLeafForSphere(spheres[2])
      expect(leaf1).not.toBeNull()
      spheres[2].center.x = -1000
      spheres[2].radius = 4
      octree.updateSphere(spheres[2])
      const leaf2 = findLeafForSphere(spheres[2])
      expect(leaf2).not.toBeNull()
      expect(leaf2).not.toBe(leaf1)
    })

    test('keeps the leaf, minus that sphere, and re-inserts if it was one of multiple spheres in the leaf', () => {
      const spheres = [
        createSphere(0, 0, 0, 0.1),
        createSphere(256, 0, 0, 0.1),
        createSphere(64, 0, 0, 0.1),
        createSphere(64, 0, 0, 0.2)
      ]
      octree.addSpheres(spheres)
      const sphere2LeafA = findLeafForSphere(spheres[2])
      const sphere3LeafA = findLeafForSphere(spheres[3])
      expect(sphere2LeafA).not.toBeNull()
      expect(sphere2LeafA).toBe(sphere3LeafA)
      spheres[3].center.x = -1000
      spheres[3].radius = 4
      octree.updateSphere(spheres[3])
      const sphere2LeafB = findLeafForSphere(spheres[2])
      const sphere3LeafB = findLeafForSphere(spheres[3])
      expect(sphere3LeafB).not.toBeNull()
      expect(sphere2LeafB).toBe(sphere2LeafA) //old leaf should remain
      expect(sphere2LeafB.data === spheres[2])
      expect(sphere3LeafB).not.toBe(sphere3LeafA)
      expect(sphere3LeafB.parent).not.toBe(sphere2LeafB.parent)
    })
  })
})




describe.skip('Benchmarks', () => {
  let allSpheres = []

  function fillWithRandomSpheresTo(num) {
    while (allSpheres.length < num) {
      const s = createSphere(randRound(100) - 50, randRound(100) - 50, randRound(100) - 50, rand(5))
      octree.addSphere(s)
      allSpheres.push(s)
    }
  }

  beforeEach(() => {
    allSpheres = []
    skipTreeValidation = true
  })

  test('sphere addition', () => {
    const messages = []
    function measure(count) {
      const startTime = performance.now()
      fillWithRandomSpheresTo(count)
      messages.push(`- Added up to ${count} in ${performance.now() - startTime}ms - ${octree.root.totalCount} spheres in ${octree.root.leafCount} leaves`)
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
      messages.push(`- Searched octree of size ${allSpheres.length} in average of ${totalTime / samples}ms`)
    }

    measure(10)
    measure(100)
    measure(1000)
    measure(10000)
    measure(100000)
    console.log(`Ray intersection test performance stats:\n${messages.join('\n')}`)
  })

  test('sphere deletion', () => {
    const messages = []
    function measure(addCount, deleteCount) {
      fillWithRandomSpheresTo(addCount)
      expect(octree.root.totalCount).toEqual(addCount)
      const toDelete = allSpheres.splice(0, deleteCount)
      const startTime = performance.now()
      toDelete.forEach(octree.removeSphere, octree)
      expect(octree.root.totalCount).toEqual(addCount - deleteCount)
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
      expect(octree.root.totalCount).toEqual(addCount)
      const toModify = allSpheres.slice(0, modifyCount)
      const startTime = performance.now()
      toModify.forEach(sphere => {
        sphere.radius *= (Math.random() - 0.5)
        octree.updateSphere(sphere)
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
      expect(octree.root.totalCount).toEqual(addCount)
      const toModify = allSpheres.slice(0, modifyCount)
      const startTime = performance.now()
      toModify.forEach(sphere => {
        sphere.center.x += (Math.random() - 0.5) * 0.000001
        sphere.center.y += (Math.random() - 0.5) * 0.000001
        sphere.center.z += (Math.random() - 0.5) * 0.000001
        sphere.radius *= (Math.random() - 0.5)
        octree.updateSphere(sphere)
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
      expect(octree.root.totalCount).toEqual(addCount)
      const toModify = allSpheres.slice(0, modifyCount)
      const startTime = performance.now()
      toModify.forEach(sphere => {
        sphere.center.x += (Math.random() - 0.5) * 100
        sphere.center.y += (Math.random() - 0.5) * 100
        sphere.center.z += (Math.random() - 0.5) * 100
        sphere.radius *= (Math.random() - 0.5)
        octree.updateSphere(sphere)
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
  const results = []
  octree.forEachSphereOnRay(ray, sphere => {
    results.push(sphere)
  })
  return results
}

function findLeafForSphere(sphere) {
  let result = null
  octree.walkTree(octant => {
    if (octant.isLeaf) {
      let matchingLeaf = null
      if (Array.isArray(octant.data)) {
        for (let i = octant.data.length; i--;) {
          if (octant.data[i] === sphere) {
            if (matchingLeaf) {
              throw new Error('Found leaf holding the same sphere twice in its `data` array, this is an invalid state.')
            }
            matchingLeaf = octant
          }
        }
      } else {
        if (octant.data === sphere) {
          matchingLeaf = octant
        }
      }
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

function expectSpheresOnRay(ray, spheres) {
  const results = findSpheresOnRay(ray)
  expect(results).toBeInstanceOf(Array)
  expect(results.length).toEqual(spheres.length)
  if (spheres.length > 0) {
    expect(results).toEqual(expect.arrayContaining(spheres))
  }
}

function calcOctreeBranchStats(root) {
  let totalCount = 0
  let leafCount = 0
  let maxRadius = 0
  octree.walkBranch(root, octant => {
    if (octant.isLeaf) {
      leafCount++
      octant.forEachLeafSphere(sphere => {
        totalCount++
        maxRadius = Math.max(maxRadius, sphere.radius)
      })
    }
  })
  return {totalCount, leafCount, maxRadius}
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

    // Check leaf data
    if (octant.isLeaf) {
      octant.forEachLeafSphere(sphere => {
        expect(sphere.center.x).toEqual(octant.dataX)
        expect(sphere.center.y).toEqual(octant.dataY)
        expect(sphere.center.z).toEqual(octant.dataZ)
      })
    }

    // Check stats
    let {totalCount, leafCount, maxRadius} = calcOctreeBranchStats(octant)
    expect(totalCount).toEqual(octant.totalCount)
    expect(leafCount).toEqual(octant.leafCount)
    expect(maxRadius).toEqual(octant.maxRadius)
    expect(totalCount).toBeGreaterThan(0) //empty octant wasn't removed correctly
    expect(leafCount).toBeGreaterThan(0)
    expect(leafCount === 1 && !octant.isLeaf).toBe(false) //branch with only one leaf under it wasn't collapsed correctly

    // Check flat index
    if (octant.isLeaf) {
      octant.forEachLeafSphere(sphere => {
        expect(octree.spheresToLeaves.get(sphere)).toBe(octant)
      })
    }
  })

  // Check for stray items in flat index
  if (octree.root) {
    expect(octree.spheresToLeaves.getSize()).toEqual(octree.root.totalCount)
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


