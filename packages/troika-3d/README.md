# Troika 3D

This package provides the ability to create interactive 3D scenes with Troika's declarative framework. It uses [Three.js](https://threejs.org) as its underlying WebGL renderer, giving you access to Three's full set of tools and its excellent community.

It does very little to abstract away from Three's API, and you will need to know the Three.js object model well to use it. But through its primary facade class, [`Object3DFacade`](#object3dfacade), it gives you a straightforward way to:

- componentize your 3D objects
- manage them all together declaratively
- apply automatic transitions and animations
- make them interactive with pointer events
- optimize for the best frame rate

> See the [Troika Core](../troika-core/) package for details about the primary concepts and features provided by the Troika framework.



## Installation

Get it from [NPM](https://www.npmjs.com/package/troika-3d):

```sh
npm install troika-3d
```

You will also need to install a compatible version of [Three.js](https://threejs.org), which is declared as a _peer_ dependency rather than a direct dependency to give you flexibility in choosing a specific version for your application.

```sh
npm install three
```

> You can look in [package.json](./package.json) under `"peerDependencies"` for a range of Three.js versions that has been verified to work with Troika's 3D packages. Other versions that have not been specifically tested may also work depending on the features you use.


## Usage

TODO:
- Canvas3D
- lights, camera, objects, ...
- Object3DFacade
  - lifetimes and cleanup
  - events
- Group3DFacade
- Html overlays
- Instanceable
- 




## Other Troika 3D Packages

Some of Troika's more advanced 3D tools have been put in separate packages to keep this one as lean as possible. Those include:

- [Troika 3D Text](../troika-3d-text/): high quality antialiased text rendering in WebGL, including a standalone version for using with Three.js outside of Troika
- [Troika 3D UI](../troika-3d-ui): flexbox layout and 2D panel rendering for interactive user interfaces in 3D scenes
- [Three.js Utils](../troika-three-utils): a collection of utilities for working with Three.js, such as shader manipulation


