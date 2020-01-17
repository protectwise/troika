# Troika Three.js Utilities

This package provides various utilities for working with [Three.js](https://github.com/mrdoob/three.js), particularly having to do with shaders. It is used by [Troika 3D](../troika-3d), but has no dependencies itself other than Three.js, so it can be used outside the Troika framework.


## Installation

Get it from [NPM](https://www.npmjs.com/package/troika-three-utils):

```sh
npm install troika-three-utils
```

You will also need to install a compatible version of [Three.js](https://threejs.org); see the notes in the [Troika 3D Readme](../troika-3d/README.md#installation) for details.


## Provided Utilities

Several utilities are provided; for a full list follow the imports in [index.js](./src/index.js) to their source files, where each is documented in JSDoc comments.

Some of the most useful ones are:

### createDerivedMaterial()

_[Source code with JSDoc](./src/DerivedMaterial.js)_

One of the most powerful things about Three.js is its excellent set of built-in materials. They provide many features like physically-based reflectivity, shadows, texture maps, fog, and so on, building the very complex shaders behind the scenes.

But sometimes you need to do something custom in the shaders, such as move around the vertices, or change the colors or transparency of certain pixels. You could use a [ShaderMaterial](https://threejs.org/docs/#api/en/materials/ShaderMaterial) but then you lose all the built-in features. The experimental [NodeMaterial](https://www.donmccurdy.com/2019/03/17/three-nodematerial-introduction/) seems promising but doesn't appear to be ready as a full replacement.

The [onBeforeCompile](https://threejs.org/docs/#api/en/materials/Material.onBeforeCompile) hook lets you intercept the shader code and modify it, but in practice there are quirks to this that make it difficult to work with, not to mention the complexity of forming regular expressions to inject your custom shader code in the right places.

Troika's `createDerivedMaterial(baseMaterial, options)` utility handles all that complexity, letting you "extend" a built-in Material's shaders via a declarative interface. The resulting material is prototype-chained to the base material so it picks up changes to its properties. It has methods for generating depth and distance materials so your shader modifications can be reflected in shadow maps. Derived materials may themselves be derived from recursively for composability.

Here's a simple example that injects an auto-incrementing `elapsed` uniform holding the current time, and uses that to transform the vertices in a wave pattern.

```js
import { createDerivedMaterial} from 'troika-three-utils'
import { Mesh, MeshStandardMaterial, PlaneBufferGeometry } from 'three'

const baseMaterial = new MeshStandardMaterial({color: 0xffcc00})
const customMaterial = createDerivedMaterial(
  baseMaterial,
  {
    timeUniform: 'elapsed',
    vertexTransform: `
      float waveAmplitude = 0.1
      float waveX = uv.x * PI * 4.0 - mod(elapsed / 300.0, PI2);
      float waveZ = sin(waveX) * waveAmplitude;
      normal.xyz = normalize(vec3(-cos(waveX) * waveAmplitude, 0.0, 1.0));
      position.z += waveZ;
    `
  }
)
const mesh = new Mesh(
  new PlaneBufferGeometry(1, 1, 64, 1),
  customMaterial
)
mesh.customDepthMaterial = customMaterial.getDepthMaterial() //for shadows
```

You can also declare custom `uniforms` and `defines`, inject fragment shader code to modify the output color, etc. See the JSDoc in [DerivedMaterial.js](./src/DerivedMaterial.js) for full details.


### BezierMesh

_[Source code with JSDoc](./src/BezierMesh.js)_ | _[Online example](https://troika-examples.netlify.com/#bezier3d)_

This creates a cylindrical mesh and bends it along a 3D cubic bezier path between two points, in a custom derived vertex shader. This is useful for visually connecting objects in 3D space with a line that has thickness to it.

```js
import { BezierMesh } from 'troika-three-utils'

const bezier = new BezierMesh()
bezier.pointA.set(-0.3, 0.4, -0.3)
bezier.controlA.set(0.7, 0.6, 0.4)
bezier.controlB.set(-0.6, -0.6, -0.6)
bezier.pointB.set(0.7, 0, -0.7)
bezier.radius = 0.01
scene.add(bezier)
```

