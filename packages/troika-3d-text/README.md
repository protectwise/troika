# `troika-3d-text`

> **PLEASE NOTE:** The standalone `TextMesh` for Three.js, which used to be accessible from this package in a custom `dist/textmesh-standalone.umd.js` file, has been promoted to its own package, [troika-three-text](../troika-three-text). You can now just import `Text` from that package directly:
>
> ```js
> import { Text } from 'troika-three-text'
> 
> let myText = new Text()
> ```

------

This package provides high quality text rendering in the Troika scene management framework, using signed distance fields (SDF) and antialiasing using standard derivatives. It is based on [troika-three-text](../troika-three-text).


## Demo

Here's [an online demo](https://troika-examples.netlify.com/#text).

## Installation

Get it from [NPM](https://www.npmjs.com/package/troika-3d-text):

```sh
npm install troika-3d-text
```

You will also need to install a compatible version of [Three.js](https://threejs.org); see the notes in the [Troika 3D Readme](../troika-3d/README.md#installation) for details.

## Usage

Import the `Text3DFacade` class:

```js
import { Text3DFacade } from 'troika-3d-text'
```

...then use it within your scene descriptor to configure it:

```js
{
  key: 'my-text',
  facade: Text3DFacade,
  text: 'Hello world!',
  fontSize: 0.2,
  color: 0x9966FF,
  z: -2
  // ...etc.
}
````

### Supported properties

`Text3DFacade` supports all properties supported by the `Text` mesh from [troika-three-text](../troika-three-text); see the documentation there for details.
