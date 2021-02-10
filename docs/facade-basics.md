---
id: facade-basics
title: Facades
---

The **`Facade`** is the central concept in the Troika framework. It serves as the "component" unit for all objects, with the following responsibilities:

- Holding the object's current state, as a simple set of flat properties
- Synchronizing that state to a more complex model or imperative code
- Enforcing a simple, consistent object lifecycle

In your app, you will define Facades to represent different types of objects in your scene. You will also make use of built-in Facade types that are specialized for specific purposes. 

Each Facade type is defined as a JavaScript `class`, extending the base `Facade` class. It has a few base methods, but otherwise each Facade class is free to define its own shape in the form of its public instance properties. Those properties will receive values from a [scene descriptor](./scene-descriptors.md) or manual updates later on.

See the [base `Facade` class source](https://github.com/protectwise/troika/blob/master/packages/troika-core/src/facade/Facade.js) for some additional class and method JSDoc.

> Why "Facade" instead of "Component"?
> 
> The main reason for this naming choice was that "Component" is used by many other frameworks (React, Web Components, etc.) Since Troika will most likely be used as a subcomponent within another web framework, it felt confusing to have the same term referring to multiple things within the same app.
> 
> Also, "Facade" is descriptive of its purpose: to create a simple public false-front that is backed by more complex code.


## Lifecycle

The facade lifecycle is intentionally very simple:

### 1. Instantiation

The Facade class's `constructor` is called, and is always passed a single argument which is the `parent` facade instance. Troika facades are _never_ reparented, so that `parent` will remain the same for the lifetime of the instance. The `constructor` is a good place to perform any initialization for things that will remain for the facade's lifetime, such as creating backing objects, setting up event listeners, etc.

### 2. Update

This is where the facade instance receives its state. Since "state" is defined as the facade object's properties, updating that state simply consists of assigning a set of property values. This is usually done by copying a [scene descriptor](./scene-descriptors.md)'s values directly onto the facade instance during a scene update pass. It can also be triggered manually via the facade's `.update({...values})` method.

This part of the lifecycle is also usually when the facade synchronizes its new state properties to its more complex backing object model.

For properties that are "standalone", meaning they don't rely on any other properties, it is common for the facade class to define [property accessors](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Working_with_Objects#defining_getters_and_setters) where the `set()` implementation updates the backing model right away.

After all properties are updated, the special `afterUpdate()` lifecycle method will always be called. This method is where you can put any implementation code that uses multiple properties together, since you can rely on all those properties being up-to-date at this time.

### 3. Destruction

When a facade instance is removed from the scene tree, its `destructor()` method is called. This is where you can perform teardown logic, dispose of backing objects, remove event listeners, etc.


## Events

Facades implement the [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) interface, so you can `addEventListener` just like you would a DOM element. Events dispatched this way can bubble, be cancelled, etc. as you'd expect.

> There is also a parallel messaging notification system that is used internally for sending large numbers of simple messages up the parent hierarchy in a highly optimized way. You likely won't need this, but see the `notifyWorld()` and `onNotifyWorld()` methods for more.

## Special Facade Classes

The base `Facade` class is a superclass of all facades, but you will seldom extend it directly. You'll instead most often use a more specialized facade type. Here are some you may want to be aware of:

### ParentFacade 

[[Source]](https://github.com/protectwise/troika/blob/master/packages/troika-core/src/facade/ParentFacade.js) - This extends `Facade` with the ability to manage not only itself but also a set of child facades. At the end of its update phase it will recursively synchronize a set of child facade instances, based on an array of [descriptor objects](./scene-descriptors.md) returned by its `describeChildren()` method (which by default returns the value of its `.children` property.)

### ListFacade

[[Source]](https://github.com/protectwise/troika/blob/master/packages/troika-core/src/facade/ListFacade.js) - Inspired by [D3](https://d3js.org/), this is an optimized way to update many of the same type of object that skips creating intermediate descriptor objects for each item. For details see [Data Lists](./scene-descriptors.md#data-lists).

### Object3DFacade, Object2DFacade

These are base facades for the [`troika-3d`](./3d-overview.md) and [`troika-2d`](./2d-overview.md) packages. If you are creating a 3D/2D graphical scene, you'll likely be extending these for most of your objects. See the docs for those packages for details.


## Example

Here's a very simple example of creating a Facade class that synchronizes some properties to a backing SuperComplicatedObject:

```js
import { Facade } from 'troika-core'

export class MyThingFacade extends Facade {
  // Instantiation:
  constructor(parent) {
    super(parent)

    // Init backing object:
    this._impl = new SuperComplicatedObject()
    
    // Define state properties with initial values:
    this.width = 1
    this.height = 1
    this.depth = 1
    this.color = '#123456'
  }
  
  // Getter/setter for directly syncing a standalone property:
  set color(value) {
    this._impl.setColor(value)
  }
  get color() {
    return this._impl.getColor()
  }
  
  // Handler for syncing interdependent properties:
  afterUpdate() {
    this._impl.setDimensions(this.width, this.height, this.depth)
    super.afterUpdate() //don't forget the super call!
  }
  
  // Cleanup:
  destructor() {
    this._impl.teardown()
    delete this._impl
    super.destructor()
  }
}
```

This facade would then be created and updated using a scene descriptor like so:

```js
{
  key: 'thing1',
  facade: MyThingFacade,
  width: 100,
  height: 45,
  depth: 23,
  color: '#336699'
}
```
