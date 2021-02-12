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

The `troika-3d` package requires `three` ([Three.js](https://threejs.org)) as a _peer_ dependency, which means you will have to declare `three` as a dependency in your own project. 

```sh
npm install --save three
```

You'll need to make sure that you keep your `three` dependency matches the range of supported versions declared in `troika-three-utils/package.json`, and keep that up to date in the future as you update Troika. You should see messages from `npm` in your terminal to remind you if you get behind.

Because the Three.js API tends to have rather [significant changes between releases](https://github.com/mrdoob/three.js/wiki/Migration-Guide), Troika has to be specific about the range of versions it currently works with. We try to keep that at the largest possible range that we know won't break. You _may_ try using a later version of `three` than officially supported, just no guarantees with that.

(It's a tad inconvenient that you have to manage this yourself, but we went this route because it makes it more obvious which version of Three.js your project uses and decreases the chance of multiple conflicting versions being installed together.)

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
