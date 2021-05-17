---
id: setup
title: Setup
---

## Installation

Troika is separated into multiple NPM packages depending on your specific needs. For the common case of creating a 3D scene, do:

```sh
npm install troika-3d
```

Additional optional packages can also be installed as needed:

```sh
npm install troika-2d
npm install troika-3d-text
etc...
```

### Dependencies

#### Three.js

The packages related to 3D require `three` ([Three.js](https://threejs.org)) as a _peer_ dependency, which means you will have to declare `three` as a dependency in your own project. 

```sh
npm install --save three
```

The allowed version range for `three` is open-ended, so you _should_ be able to use any relatively recent version without issues. However, Three.js releases do often contain [breaking changes](https://github.com/mrdoob/three.js/wiki/Migration-Guide) which may introduce incompatibilities in the future. While we try to test against recent `three` versions on a regular basis, some of these may slip by our notice; if you find one, please [open an issue](https://github.com/protectwise/troika/issues) for us.


#### React

Assuming you want to use the React component wrappers (`Canvas3D` etc.), you'll also need to add `react` and `react-dom` to your project's dependencies if not already there:

```sh
npm install --save react react-dom
```

You don't need to do this if you're using Troika without the React wrappers (impressive!) or are just using some of its utilities.


## Importing

You should now be able to import from `troika-3d` as needed...

### as ES2015 modules

```js
import {Canvas3D, Object3DFacade} from 'troika-3d'
```

### as CommonJS modules

```js
const {Canvas3D, Object3DFacade} = require('troika-3d')
```

### as globals

If you are not using a module-aware build pipeline, Troika's UMD bundles expose globals you can use instead; you'll need to include the proper dependencies manually.

> Note: This usage pattern is not well tested; please report bugs with it.

```html
<script>
var Canvas3D = troika_3d.Canvas3D;
var Object3DFacade = troika_3d.Object3DFacade;
//...
</script>
```

## Source Code Checkout

If you want to work with the source code or [run the examples](examples.md) locally, clone it from the GitHub repository:

```
git clone https://github.com/protectwise/troika.git
cd troika
npm install
```
