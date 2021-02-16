---
id: 3d-auto-optimizations
title: Performance Optimization
---

Compared to raw Three.js, Troika automatically performs several optimizations to reduce the CPU time spent on each render frame. Here are the most impactful:

## Unnecessary renders

The [typical setup for Three.js rendering](https://threejs.org/docs/index.html#manual/en/introduction/Creating-a-scene) involves an animation loop that recursively calls `requestAnimationFrame` and re-renders the entire scene on every frame, regardless of whether anything in the scene has actually changed. This causes unnecessarily high CPU/GPU usage and battery drain for scenes that are largely static.

Troika controls when the Three.js scene is re-rendered, only doing so when:

* The scene is updated
* A facade [`animation` or `transition`](../troika-core/animations-and-transitions.md) is running
* A facade changes properties due to [`pointerStates`](../troika-core/interactivity-and-events.md#pointer-states) interactions
* A facade indicates that it requires a re-render by calling `this.notifyWorld('needsRender')`


## Matrix calculations

By default, Three.js takes a brute-force approach to calculating the world matrices of objects: on every frame it traverses the entire scene graph and for each `Object3D` it both composes a local transform `matrix` and multiplies it with the parent to get its `worldMatrix`. This can quickly add up to be the primary CPU user in large scenes, even if no objects are moving.

The [Object3D.matrixAutoUpdate](https://threejs.org/docs/#api/en/core/Object3D.matrixAutoUpdate) and [Scene.autoUpdate](https://threejs.org/docs/#api/en/scenes/Scene.autoUpdate) flags _do_ allow you to limit the brute-force matrix calculations, but then performing those updates manually (a tedious and error-prone process) becomes the author's responsibility.

Troika gives you the best of both worlds by automatically setting `scene.autoUpdate=false` and `threeObject.matrixAutoUpdate=false` for every object it manages, and then taking care of recalculating the local and/or world matrices _only_ when necessary. More specifically:

* The local `matrix` is only recomposed when one of the properties that may affect it (`x`/`y`/`z`/`rotateX|Y|Z`/`scaleX|Y|Z`) changes.
* The `worldMatrix` is only remultiplied when the local `matrix` or the `worldMatrix` of its parent have changed.

This results in the time taken by matrix calculations dropping to nearly zero when objects are not moving, even for very large scenes.

> NOTE: This is perhaps the single most valuable optimization Troika performs. Not only does it nearly remove the per-frame matrix update cost, but knowing exactly when any object's matrix is changed opens up the possibility for other optimizations like maintaining a [raycasting octree](#raycasting) and more flexible [GPU instancing](./instancing.md) abstractions.
> 
> It is our goal to attempt extracting this matrix management capability from Troika's framework code, allowing it to be used in any Three.js scene, even if managed by another framework.


## Raycasting

The standard method for picking 3D objects with a pointer (mouse/touch/etc.) is to determine a ray for that pointer and then search the scene's objects for those that intersect that ray, also known as "raycasting." Three.js provides a [Raycaster](https://threejs.org/docs/#api/en/core/Raycaster) class for that purpose; however the usual approach is to iterate through all the objects in the scene and calculate the ray intersection for each. For scenes with many objects this can quickly add up and produce frame drops while raycasting.

Troika optimizes this process by maintaining an internal [Octree](https://en.wikipedia.org/wiki/Octree) of the bounding spheres for every object in the scene, and then using that as a fast pre-filter to skip ray intersection calculations for objects that have no possibility of matching.

> TODO: note about how to specify bounding sphere for use in the octree when using custom shaders that manipulate the vertices


## Scene graph traversal

On every render frame Three.js traverses the entire scene graph, deciding what to do with each type of object in the tree, if anything. This means it does several type checks for every object, even those that have no visible representation in the scene, such as empty `Group`s or the invisible objects used for tracking [HTML Overlay](./html-overlays.md) positions.

To help with this, Troika performs the following optimizations for those objects it manages which it knows have no visible rendering:

* It sets [`threeObject.layers.mask = 0`](https://threejs.org/docs/#api/en/core/Object3D.layers), which makes the renderer skip its per-frame type checks.
* If the object has no children, it is not added to the Three.js scene graph at all.

> Authors may also set the custom property `threeObject.isRenderable = false` to gain these same optimizations for their own invisible objects. The proeprty must be set prior to passing the object to the `Object3DFacade`'s constructor.


## Batch object removal

Removing large numbers of scene objects from their parents can be slow in Three.js due to how it splices the parent's `children` array for each object removed. Troika batches the removal of many children into a single operation to speed this up.
