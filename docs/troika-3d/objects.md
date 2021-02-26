---
id: 3d-objects
title: Adding 3D Objects
---

So you've got a [3D scene](./scenes.md) with a camera and now you want to add some 3D objects to it, naturally!

Like every other object in Troika, 3D object types are defined by [Facades](../troika-core/facades.md), and configured by [scene descriptors](../troika-core/scene-descriptors.md). To help you out, The `troika-3d` package provides some Facade types that know how to manage and optimize a tree of Three.js objects. They all use `Object3DFacade` as their foundation:

## Object3DFacade

Any Three.js [`Object3D`](https://threejs.org/docs/#api/en/core/Object3D) in your scene will, naturally, be represented by an `Object3DFacade`. This is a specialized Facade base class which knows some things about dealing with `Object3D`, such as:

- Properties for positioning/rotation/scaling, with automatic optimized matrix updates
- Raycasting methods, with related optimizations
- Methods for querying world positions, camera position, etc.
- Various shortcut passthrough properties

This is just a base class, so in most cases it will be more convenient for you to use a [`MeshFacade`](#meshfacade) or a [`Group3DFacade`](#group3dfacade), but all the properties and methods described here will apply to those as well.

### Construction

Every concrete subclass of `Object3DFacade` must create a Three.js `Object3D` instance (a `Mesh`, `Line`, `Group`, etc.) that will become the backing implementation for that facade. It will be stored as `this.threeObject` for use later on, and will be guaranteed to never change during the lifetime of the facade instance. This strict contract makes it easier to reason about in other logic, and allows Troika to apply certain optimizations it couldn't otherwise.

To create the `Object3D`, you can either:

1) Implement the `initThreeObject()` method and return the `Object3D` instance, or
2) Override the `constructor` and pass the `Object3D` as a second argument to `super(parent, obj3D)`

Generally the first method is preferred, though if you're already overriding the constructor for other purposes then the second method can be easier.

An example using `initThreeObject()`:

```js
import { Object3DFacade } from 'troika-3d'
import { Mesh, BoxBufferGeometry, MeshStandardMaterial } from 'three'

// It's often to define a singleton geometry instance that can be used
// across all instances of this object type:
const geometry = new BoxBufferGeometry()

class MyObject extends Object3DFacade {
  initThreeObject() {
    return new Mesh(geometry, new MeshStandardMaterial())
  }
  
  afterUpdate() {
    // The Mesh created above can be referenced as `threeObject`:
    this.threeObject.material.color.set(this.color)
    super.afterUpdate()
  }
}
```

Or an example `constructor` override:

```js
//...

class MyObject extends Object3DFacade {
  constructor(parent) {
    const threeObj = new Mesh(geometry, new MeshStandardMaterial())
    super(parent, threeObj)
  }
  
  // ...
}
```


### Properties

The following properties are supported by all `Object3DFacade` subclasses:

- `threeObject` - This is a reference to the Three.js `Object3D` instance that was created in the `initThreeObject` method or the constructor. This will be a stable reference, never changing during the facade instance's lifetime. It will be deleted upon destruction, however.

- `parent` - This is a reference to the parent _Facade_ instance. This will be a stable reference, never changing during the facade instance's lifetime. It will be deleted upon destruction, however.

    To access the nearest parent _Object3D_, use `this.threeObject.parent` instead.

- `castShadow`, `receiveShadow` - Shortcuts to setting these shadow-related properties on the threeObject.
- `renderOrder` - Shortcut to the `renderOrder` property on the threeObject.
- `visible` - Shortcut to the `visible` property on the threeObject.
- `raycastSide` - Lets you force a different [`side`](https://threejs.org/docs/#api/en/materials/Material.side) than that of the material during mesh raycasting. Should be set to `FrontSide`|`BackSide`|`DoubleSide`, or `null` to use the material's `side`.

#### Local Transform Properties

These properties expose the Three object's `position`, `scale`, `quaternion`, and `rotation` objects' values. They are synced to those objects, but exposing them as flat Facade properties makes it easy to [animate them](../troika-core/animations-and-transitions.md) and to track their changes for optimized matrix updating.

- `x`, `y`, `z` - These set the object's position transform in local space.

- `scale`, `scaleX`, `scaleY`, `scaleZ` - These set the object's scale transform in local space. The `scale` shortcut sets all the directional scales to the same value.

- `rotateX`, `rotateY`, `rotateZ`, `rotateOrder` - These set the object's [Euler](https://threejs.org/docs/#api/en/math/Euler) rotation transform in local space.

- `quaternionX`, `quaternionY`, `quaternionZ`, `quaternionW` - These set the object's [Quaternion](https://threejs.org/docs/#api/en/math/Quaternion) rotation transform in local space.


### Methods

- `getWorldPosition(Vector3?)` - Gets the world position of this object's origin. If a Vector3 is passed, the position will be written into that object, otherwise it will return a new Vector3. Assuming this is called in the facade's [update phase](../troika-core/facades.md#updates), the world matrix will be up-to-date.
  
- `getProjectedPosition(x, y, z)` - Given x/y/z coordinates in _local_ space, calculates the projected _view_ space coordinates. Returns a Vector3 where `x` and `y` are the view position in screen pixels, and `z` is the worldspace distance from the camera.

- `getCameraPosition(Vector3?)` - Gets the current world position of the camera. If a Vector3 is passed, the position will be written into that object, otherwise it will return a new Vector3.

- `getCameraDistance()` - Returns the current distance in world units between this object's origin and the camera.

- `getCameraFacade()` - Returns a reference to the `CameraFacade` instance. This can be used to access low-level info about the camera such as its various matrices and projection attributes, but be careful not to make modifications to the camera as that can lead to things getting out of sync.

- `getSceneFacade()` - Returns a reference to the `SceneFacade` instance. This can be useful in a pinch, but it's usually better to pass any required scene-level values to each facade.

- `updateMatrices()` - Updates the underlying threeObject's `matrix` and `matrixWorld` to the current state of this object's transform and those of its ancestors, if necessary. This bypasses the `updateMatrix` and `updateMatrixWorld` methods of the Three.js objects with a more efficient approach that doesn't require traversing the entire tree prior to every render. As long as this is called from the `afterUpdate` lifecycle method or later, it can be safely assumed that the world matrices of all ancestors have already been similarly updated, so the result should always be accurate.

- `markWorldMatrixDirty()` - If the `threeObject.matrixWorld` is modified manually instead of via the [local transform properties](#local-transform-properties), as is sometimes required for more complex transformations, you should call this to update the internal caches and signal that child objects should update their own matrices to match.


## MeshFacade

You will likely most often want to use `MeshFacade` instead of creating your own `Object3DFacade` subclass. This prevents you from having to implement your own constructor override, creating a `Mesh` instance automatically, and adds some additional helpful facade properties for you.

### Properties

- `geometry` - Lets you set the mesh's `geometry`. You'll usually only do this once, but you can also change it on the fly, e.g. for choosing an LOD based on camera distance.

- `material` - Lets you change the mesh's `material`. In addition to accepting Three.js Material instances, it also supports the following string aliases for common built-in Three.js materials: "basic", "depth", "distance", "lambert", "matcap", "normal", "phong", "physical", "standard", and "toon". Defaults to "standard" for creating a `MeshStandardMaterial`.

- `material.xyz` - For all of the above built-in material types, MeshFacade automatically creates setters for the properties of those materials. For example in a scene descriptor object:

    ```js
    {
      facade: MeshFacade,
      //...
      material: 'standard',
      'material.color': 0x3366cc,
      'material.metalness': 0.8,
      'material.roughness': 0.5
    }
    ```

    Notice how you must include quotes around the material properties since they include dots in them.

- `autoDisposeGeometry` - If set to `true`, the geometry's [`dispose`](https://threejs.org/docs/#api/en/core/BufferGeometry.dispose) method will automatically be called when the facade is destroyed, and when swapping it out with another geometry. 
  
    This can be useful for freeing resources for large geometries that only appear once, but can hurt performance if there are multiple instances of that geometry in the scene or if it is removed and re-added later. In many cases, especially for simpler geometries, it's better to avoid disposal; therefore this defaults to `false`.

- `autoDisposeMaterial` - If set to `true`, the material's [`dispose`](https://threejs.org/docs/#api/en/materials/Material.dispose) method will automatically be called when the facade is destroyed, and when swapping it out with another material. This is almost never needed, so it defaults to `false`.

    If your material uses a `Texture` that needs to be disposed, you will need to do that yourself, e.g. in a subclass that overrides the `destructor` method.

## Group3DFacade

This is a specialized `Object3DFacade` for Three.js [`Group`](https://threejs.org/docs/#api/en/objects/Group) objects.

It's basically just an `Object3DFacade` that already creates a `Group` object in its constructor, though it also applies some additional optimizations. You can use it directly in scene descriptors, with any child objects as its `children`:

```js
import { Group3DFacade } from 'troika-3d'

//...descriptor in scene:
{
  facade: Group3DFacade,
  z: -1,
  scale: 0.5,
  children: [
    {
      facade: DonutFacade,
      x: -1
    },
    {
      facade: PyramidFacade,
      x: 1
    }
  ]
}
```

It can also be useful to _extend_ a custom Facade class from `Group3DFacade`, for example to implement some controller logic or to manage a collection of rendered objects as a single component.

```js
class GaugeFacade extends Group3DFacade {
  /** @type number - from 0 to 100 */
  value = 0
  
  describeChildren() {
    return [
      {
        key: 'ring',
        facade: GaugeRing, //another custom facade
        percent: this.value,
        color: valueToColor(this.value),
        radius: 0.1,
        transition: {percent: true} //animate ring changes
      },
      {
        key: 'label',
        facade: Text3DFacade, //see troika-3d-text package
        anchorX: 'center',
        anchorY: 'middle',
        fontSize: 0.05,
        text: `${this.value}%`
      }
    ]
  }
}
```

Also, since [pointer events bubble](../troika-core/interactivity-and-events.md#pointer-events), you can add listeners on a Group3DFacade to respond to raycasting events on any of its descendant objects. Just remember that you may need to set `pointerEvents: true` on those objects to trigger raycasting for them.


## Instanceable3DFacade

This is a special kind of `Object3DFacade` that renders its underlying object using GPU instancing along with all other `Instanceable3DFacade` instances of the same type, but behaves as its own component instance in terms of how it's configured and handles events. See the [page on instancing](./instancing.md) for details.
