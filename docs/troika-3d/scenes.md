---
id: 3d-scenes
title: Creating a 3D Scene
---

So you want to create a 3D scene! Let's go.

> Note: Currently the only entry point provided is a React component called `<Canvas3D>`. This assumes your application uses React, and you're adding a Troika 3D canvas into it. In the future we plan to provide entry points for other frameworks, a web component, and a pure JS entry point function. Contributions are welcome.

## Canvas3D

The `<Canvas3D>` React component is your starting point. This component creates a WebGL canvas and other required DOM elements, takes configuration props for the Three.js renderer, and accepts [descriptors](../troika-core/scene-descriptors.md) for a camera, lights, and all your scene's objects.

### Configuration Props

- `width` and `height` - These are _required_ to set the size of the canvas. If you want to have the canvas expand to the size of its container, then you'll need to use something like [`useDimensions`](https://www.npmjs.com/package/react-use-dimensions) in your outer React component to measure the available size.

- `antialias` - If set, enables antialiasing.

- `background` - Sets the Three.js scene's [`background`](https://threejs.org/docs/#api/en/scenes/Scene.background)

- `canvasStyle` - An optional object holding CSS style properties to apply to the `<canvas>` element. Defaults to `{width: '100%', height: '100%'}`.

- `className` - An optional `class` attribute that will be applied to the wrapper element. Defaults to `"troika"`.

- `continuousRender` - If set, frames will be rendered continuously, instead of the default behavior of only rendering when something in the scene requires it.

- `environment` - Sets the Three.js scene's [`environment`](https://threejs.org/docs/#api/en/scenes/Scene.environment)

- `onBackgroundClick` - A function that will be called when the user clicks the scene's background without hitting an object.

- `outputEncoding` - Sets the Three.js renderer's [`outputEncoding`](https://threejs.org/docs/#api/en/renderers/WebGLRenderer.outputEncoding)

- `outputColorSpace` - Sets the Three.js v153+ renderer's [`outputColorSpace`](https://threejs.org/docs/#api/en/renderers/WebGLRenderer.outputColorSpace)

- `pixelRatio` - Sets the pixel ratio for the canvas. Defaults to the current screen's reported `window.devicePixelRatio`.

- `rendererClass` - Lets you override the Three.js `WebGLRenderer` class with a custom subclass of your own.

- `stats` - If set, statistics about the frame rate and number of things rendered will be displayed. Useful for debugging.

- `toneMapping` - Sets the Three.js renderer's [`toneMapping`](https://threejs.org/docs/#api/en/renderers/WebGLRenderer.toneMapping)

- `worldFacade` - Lets you override the `World3DFacade` class used as the main world controller with a custom subclass of your own.

- `worldProps` - An object holding properties that will be copied onto the `worldFacade`.

### Scene Structure Props

#### `lights`

This should be set to an array of descriptor objects describing the main lights in your scene. You can choose the type of light with the `type` property and one of the following strings: "ambient", "directional", "spot", "point", or "hemisphere". You can also set the `facade` property to use a custom facade wrapper.

```js
lights={[
  {type: 'ambient', color: 0x999999},
  {type: 'directional', x: 1, y: 1, z: 1},
  {facade: WanderingPointLight, color: 0xff0000}
]}
```

#### `camera`

This should be set to a descriptor object describing the type of camera, its projection parameters, position, etc. It defaults to a `PerspectiveCamera3DFacade` with aspect ratio based on the canvas's dimensions.

```js
camera={{
  x: 5,
  rotateY: -Math.PI / 2,
  fov: 75,
  far: 30
}}
```

```js
import { OrthographicCamera3DFacade } from 'troika-3d'

//...

camera={{
  facade: OrthographicCamera3DFacade,
  z: 1,
  top: height / 2,
  bottom: -height / 2,
  left: 0,
  right: width
}}
```

```js
camera={{
  facade: OrbitingCameraFacade //a custom facade with orbiting movement
}}
```

Since this camera config is a [descriptor object](../troika-core/scene-descriptors.md), it can also be given [animations and transitions](../troika-core/animations-and-transitions.md).

```js
camera={{
  x: currentPos.x,
  z: currentPos.z,
  rotateY: currentPos.angle,
  // Smoothly transition between positions:
  transition: {
    x: true,
    z: true,
    rotateY: true
  },
  // Bob in place:
  animation: {
    from: { y: 1.4 },
    to: {y: 1.5},
    duration: 3000,
    direction: 'alternate',
    iterations: Infinity
  }
}}
```

#### `objects`

This is an array of descriptor objects describing all the things in your scene. See the page on [Adding 3D Objects](./objects.md) for details.

```js
objects={[
  {
    key: 'mainGroup',
    z: -2,
    facade: Group3DFacade,
    children: [
      {
        facade: SphereFacade,
        radius: 0.25,
        x: -1,
        'material.color': 0x3366cc
      },
      {
        facade: CustomObjectFacade,
        x: 1
      }
    ]
  }
]}
```

#### `fog`

This is an object holding config properties for a Three.js [`Fog`](https://threejs.org/docs/#api/en/scenes/Fog) or [`FogExp2`](https://threejs.org/docs/#api/en/scenes/FogExp2). It is not a proper Troika descriptor; if it has a `density` property it will create a `FogExp2` otherwise it will create a `Fog`.
