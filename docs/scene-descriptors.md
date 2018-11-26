---
id: scene-descriptors
title: Scene Descriptors
---

The _scene descriptor_ describes the structure of your scene at a point in time. As you apply new scene descriptors over time based on the changing state of your application, Troika tracks the differences from one descriptor to the next, and creates/destroys/updates a tree of [_Facade_](facade-basics.md) instances to match.

Describing your scene declaratively this way removes the mental overhead of having to track and modify individual objects over time, making your scenes much easier to understand and debug.

If you are familiar with [React](https://reactjs.org), this will feel very familiar. In fact Troika's scene descriptor model is highly inspired by React. The scene descriptor behaves very much like JSX descriptors, and Troika's Facades are in some ways similar to React's Components.


## A Basic Descriptor

A descriptor is just a plain JS object with a set of properties. Here's a basic example:

```js
{
  facade: BallFacade,
  x: 1,
  y: 5,
  z: -10,
  color: 0x3333cc
}
```

The only property that a descriptor _must_ include is `facade`. It defines the specific `Facade` subclass that will be instantiated for this object.

All the other properties are simply copied to that facade instance when the scene is updated. That specific facade's implementation controls what those properties _mean_ in terms of their representation in your graphical scene. Typically this means syncing those property changes to a more complex underlying API such as a Three.js mesh/geometry/material.

> While Troika has a few built-in facade types, for the most part they will be something that you must implement for the kinds of objects in your scene. See [Facade Basics](facades.md) for details and simple examples.


## Special Descriptor Properties

While most properties are just copied to the facade instance, a few of them have special meanings:

### `key`

A descriptor _may_ include a `key` string property, identifying the specific facade instance corresponding to that descriptor object. The key must be unique among its siblings within a given parent.

If omitted, Troika will generate a key internally based on the `facade` subclass and position among siblings. However it is recommended that you always include an explicit `key`, to avoid sometimes confusing situations with instance swapping, particularly when using animations and transitions.

```js
{
  facade: BallFacade,
  key: 'ball1',
  x: -2
},
{
  facade: BallFacade,
  key: 'ball2',
  x: 2
}
```

### `children`

Many Troika facades (those inheriting from `ParentFacade`) allow a `children` property,pointing to an array of child descriptors, or a single child descriptor object if there is only one.

```js
{
  facade: Group3DFacade,
  key: 'group',
  rotateZ: Math.PI / 2,
  children: [
    {
      facade: BallFacade,
      key: 'ball1',
      x: -2
    },
    {
      facade: BallFacade,
      key: 'ball2',
      x: 2
    }
  ]
}
```

### `transition`, `animation`, `exitAnimation`

A descriptor with one of these properties causes the instantiated Facade class to be wrapped as `Animatable`, allowing you to declaratively define how other property values should change over time.

These are based very closely on [CSS Transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Transitions/Using_CSS_transitions) and [CSS Keyframe Animations](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations/Using_CSS_animations), and are covered in detail in [Animations and Transitions](animations-and-transitions.md).

### `pointerStates`

Similarly, the presence of a `pointerStates` property will wrap the facade instance so that it automatically changes its state in response to pointer events. This gives you declarative control over styling for `hover` and `active` states, much like CSS pseudoclasses, without having to write imperative event handlers every time. This is covered in detail in [Pointer States](pointer-states.md).

### `ref`

If your code needs a reference to the `Facade` object instantiated for a given descriptor, you can give it a `ref` property pointing to a function. That function will be called, passed the facade instance as its argument, when the facade is created. It will also be called, with `null` as its argument, when the facade is destroyed (removed from the scene.)

If the `ref` is reassigned to a different function during an update, the old one will be called with `null` and the new one will be called with the facade instance. This is usually not what you want, so to avoid this churn make sure the exact same function is passed across updates.

```js
function ballRefFunction(ballFacade) {
  console.log('BallFacade was ' + (ballFacade ? 'created' : 'destroyed'))
}

//...

{
  facade: BallFacade,
  key: 'ball',
  ref: ballRefFunction
}
```

As in React, there is [seldom a need to use `ref`](https://reactjs.org/docs/refs-and-the-dom.html), but it can be a useful tool in those rare cases.


## Data Lists

In cases where you need to describe a large number of scene objects, such as when you are mapping from a large set of data items, it is inefficient to create a large array of `children` with a scene descriptor object for each item. Troika provides a `ListFacade` to handle these cases more efficiently.

Instead of a descriptor object for each item, you define a single descriptor object bound to a `data` array, with a `template` object that describes how the items in that `data` array should be mapped to facade instances.

```js
import {ListFacade} from 'troika-3d'

//...

{
  facade: ListFacade,
  key: 'myList',
  data: myArrayOfDataItems,
  template: {
    facade: BallFacade,
    key: d => d.id,
    x: (d, i) => i * 2,
    y: d => d.value / maxValue * 10,
    z: -10
  }
}
```

This pattern is inspired by how [d3.js](https://github.com/d3/d3-selection-multi#selection_attrs) binds data to attributes without creating a full set of intermediary objects.

Each property in the `template` can either be a constant literal value (e.g. a number or string), or a function. Literals will be copied directly to each spawned child. Functions will be called for each item, passing three arguments: the current item from the `data` array, the current index in the array, and the full array. The value returned by the function will be copied to that child facade.

In cases where you want an actual function to be copied, such as assigning event handlers, you will need to wrap those in a function that returns your function.

```js
  template: {
    //...
    onClick: () => this.onBallClicked
  }
```


## Alternate JSX syntax

If you are using React for the rest of your application, it can sometimes be confusing to have to step between using JSX for React content descriptors and the plain JS object descriptors for Troika content. To smooth this over, Troika is able to accept JSX elements in place of most JS object descriptors, assuming your build pipeline pre-transforms JSX to `React.createElement()` calls.

When representing Troika descriptors in JSX, the `facade` value is used as the JSX element name, `children` are represented as nested JSX child elements, and all other properties are written as JSX attributes.

For example:

```js
{
  facade: Group3DFacade,
  key: 'grp',
  rotateZ: Math.PI / 2,
  children: [
    {
      facade: BallFacade,
      key: 'ball1',
      x: -2
    },
    {
      facade: BallFacade,
      key: 'ball2',
      x: 2
    }
  ]
}
```

...is equivalent to:

```jsx
<Group3DFacade
  key="group"
  rotateZ={Math.PI / 2}
>
  <BallFacade
    key="ball1"
    x={-2}
  />
  <BallFacade
    key="ball2"
    x={2}
  />
</Group3DFacade>
```

While the JSX sugar can often be more readable, it does have a slight performance impact due to more transient objects being created and `React.createElement()`'s own internal logic being run for each element. Try to avoid it and stick with plain JS descriptors when your scene contains a large number of them.

