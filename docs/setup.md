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

The `troika-3d` package will automatically pull in `three` ([Three.js](https://threejs.org)) as a dependency, at the latest specific version that has been tested to work with Troika. It is recommended that you do _not_ directly declare `three` in your project's NPM dependencies, as version mismatches can cause Three.js to be included twice and/or cause compatibility issues due to Troika and your own code using parts from different versions.

#### React

Assuming you want to use the React component wrapper, you'll also need to add `react` and `react-dom` to your project's dependencies if not already there:

```sh
npm install react react-dom
```


## Importing

You should now be able to import from `troika-3d` as needed...

### as ES2015 modules

```js
import {Canvas3D, Object3DFacade} from 'troika-3d'
```

### as CommonJS modules

```js
const {Canvas3D, Object3DFacade} = require('troika-3d)
```

### as globals

If you are not using a module-aware build pipeline, Troika's UMD bundles exposes globals you can use instead; you'll need to include the proper dependencies manually.

> Note: This usage pattern is not well tested; please report bugs with it.

```html
<script src="path/to/troika-animation.umd.js"></script>
<script src="path/to/troika-core.umd.js"></script>
<script src="path/to/troika-3d.umd.js"></script>

<script>
var Canvas3D = troika_3d.Canvas3D;
var Object3DFacade = troika_3d.Object3DFacade;
//...
</script>

```
