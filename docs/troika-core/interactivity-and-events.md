---
id: interactivity-and-events
title: Interactivity and Events
---

All [Facades](./facades.md) implement [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget), and mostly behave like DOM nodes in terms of how event listeners are added/removed and dispatched, including bubbling. In addition, Troika automatically dispatches certain handy events for you to utilize.


## Pointer Events

Both `troika-3d` and `troika-2d` automatically intercept mouse events on the canvas, find any visible objects intersecting the pointer ("raycasting"), and dispatch corresponding events on those facades. This lets you treat 2D/3D objects like you would HTML DOM nodes in terms of pointer interactions.

> Note: Also see [Troika 3D's Interactivity and Events](../troika-3d/interactivity-and-events.md) documentation for additional details and capabilities provided by pointer events in Troika 3D scenes.

By default, objects in the scene will _not_ intercept the pointer unless they have a listener for one of the pointer-related events. This is both because 3D scenes in particular often have semi-transparent things that you wouldn't want to interfere with selecting objects beyond, and also an optimization to avoid expensive raycasting of things that aren't needed.

If necessary, you can set a facade's `pointerEvents` property to `true` to force raycasting of objects without pointer event listeners. Setting it to `false` will prevent raycasting even if a listener is present.

Pointer events can be subscribed do either using `addEventListener` with the event name, or by assigning a corresponding `onEventName` property in a descriptor object. Since these events all bubble, you can also listen for them on container facades (as long as a visible descendant is set to intercept `pointerEvents`.)

The following basic events are suppported:

| Event Name | Property Name |
| ---------- | ------------- |
| mousemove  | onMouseMove
| mouseover  | onMouseOver
| mouseout   | onMouseOut
| mousedown  | onMouseDown
| mouseup    | onMouseUp
| click      | onClick
| dblclick   | onDoubleClick
| wheel      | onWheel

In addition, the following events are supported for drag-and-drop interactions. These work like the corresponding events in the [HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API), just with Facades instead of DOM nodes.

| Event Name | Property Name |
| ---------- | ------------- |
| dragstart  | onDragStart
| drag       | onDrag
| dragenter  | onDragEnter
| dragover   | onDragOver
| dragleave  | onDragLeave
| drop       | onDrop
| dragend    | onDragEnd


## Pointer States

One of the most common uses of pointer events is to implement visual responses on hover or click. You can of course do this by adding "mouseover", "mouseout", etc. handlers which modify certain facade properties. But Troika also provides a handy declarative shortcut for this, `pointerStates`, which lets you define these effects much like `:hover` or `:active` in CSS.

In your [descriptor object](./scene-descriptors.md), add a `pointerStates` property holding `hover` and/or `active` object values. Each of those defines a set of property values that will be applied upon mouseover/mousedown, and un-applied on mouseout/mouseup. For example:

```js
{
  key: 'foo',
  facade: MyFacade,
  color: 'white',
  pointerStates: {
    hover: {color: 'lightskyblue'},
    active: {color: 'deepskyblue'}
  }
}
```

## Other Events

### beforerender, afterrender

These events are fired on any elements with listeners for them, immediately before and after the scene is rendered. This can be a good place to put logic that needs to run every frame. A beforerender handler is able to [update](facades.md#updatevalues) the facade's state, prepare the backing implementation objects for rendering, etc.

> Note: this `beforerender` listener is different than Three.js's `Object3D.onBeforeRender()` -- it means "before the scene renders", not "before this object renders". The difference can be subtle; for example it will be fired for Group objects or other component facades without visible object renderings, and will fire even for objects that would be frustum-culled out of the rendered view.


## Custom Event Properties

When designing Facade components that fire events, you may want to expose named properties for those events so that handlers can be added via scene descriptors. You can use the static `Facade.defineEventProperty` function to add getters/setters for this purpose:

```js
class TableFacade extends ParentFacade {
  onSomeAction() {
    this.dispatchEvent(new CustomEvent('flip'))
  }
}

// Define an `onFlip` property that responds to the 'flip' event:
Facade.defineEventProperty(
  TableFacade, //the facade class
  'onFlip', //the name of the property
  'flip' //the name of the event
)

// ...descriptor later on:
{
  facade: TableFacade,
  onFlip: e => { /* do something */ }
}

```
