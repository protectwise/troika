---
id: interactivity-and-events
title: Interactivity and Events in 3D
---

Objects in 3D scenes inherit all the useful event handling features from Troika Core's event system. See the core [Interactivity and Events](../troika-core/interactivity-and-events.md) documentation for what it can do.

Troika 3D also adds some enhancements, which are described here:

## Raycasting

Any [`Object3DFacade`](./objects.md#object3dfacade) with a pointer-related event listener, a `pointerStates` property, or `pointerEvents:true` will be raycasted in the scene and, if that raycast intersects, will dispatch a corresponding event like "mouseover", which bubbles up the facade tree.

The event object that is dispatched will _always_ have a `ray` property holding a Three.js [`Ray`](https://threejs.org/docs/#api/en/math/Ray), which will be set from the mouse position on screens, or from a pointer ray in [WebXR](../troika-xr/index.md), etc. as appropriate. Because the event can come from different sources, it's safer for handler code to rely on that `ray` rather than trying to use `e.clientX` etc.

The raycasting process is highly optimized behind the scenes using an octree prefilter. See the [performance](./performance.md#raycasting) doc for details.


