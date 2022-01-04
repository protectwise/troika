# InstancedUniformsMesh

This package provides a `InstancedUniformsMesh` class which extends Three.js's [`InstancedMesh`](https://threejs.org/docs/#api/en/objects/InstancedMesh) to allow its material's shader uniforms to be set individually per instance. It behaves just like `InstancedMesh` but exposes a new method:

```js
mesh.setUniformAt(uniformName, instanceIndex, value)
```

When you call `setUniformAt`, the geometry and the material's shaders will be automatically upgraded behind the scenes to turn that uniform into an instanced buffer attribute, filling in the other indices with the uniform's default value. You can do this for any uniform of type `float`, `vec2`, `vec3`, or `vec4`. It works both for built-in Three.js materials and also for any custom ShaderMaterial.

For example, here is how you could set random `emissive` and `metalness` values for each instance using a `MeshStandardMaterial`:

```js
import { InstancedUniformsMesh } from 'three-instanced-uniforms-mesh'

const count = 100
const mesh = new InstancedUniformsMesh(
  someGeometry,
  new MeshStandardMaterial(),
  count
)
const color = new Color()
for (let i = 0; i < count; i++) {
  mesh.setMatrixAt(i, someMatrixValue)
  mesh.setUniformAt('metalness', i, Math.random())
  mesh.setUniformAt('emissive', i, color.set(Math.random() * 0xffffff))
}
```

While this is obviously useful for Three.js's built in materials, it _really_ shines with custom shaders. Just declare any configurable parameters as uniforms in your custom shader, and then you can use that either on a single non-instanced `Mesh` by setting the material's uniforms directly, or instance it using `InstancedUniformsMesh` by calling `setUniformAt`. Your shader doesn't need to change at all to support the instancing! 

> Note: Calling `setUniformAt` automatically marks the underlying buffer attributes for upload, so unlike [`setMatrixAt`](https://threejs.org/docs/#api/en/objects/InstancedMesh.setMatrixAt) or [`setColorAt`](https://threejs.org/docs/#api/en/objects/InstancedMesh.setColorAt) you don't need to set `needsUpdate` manually.


### Value Types

The type of the `value` argument should match the type of the uniform defined in the material's shader:

| For a uniform of type:    | Pass a value of this type:       |
|---------------------------|----------------------------------|
| float                     | Number                           |
| vec2                      | `THREE.Vector2`                  |
| vec3                      | `THREE.Vector3` or `THREE.Color` |
| vec4                      | `THREE.Vector4`                  |
| mat3 (ThreeJS r132+ only) | `THREE.Matrix3`                  |
| mat4 (ThreeJS r132+ only) | `THREE.Matrix4`                  |


### Resetting to defaults

If you have set instance-specific values for a given uniform but you want to revert all those to the single original uniform value, you can call:

```js
mesh.unsetUniform(uniformName)
```

### Examples

- [Instanced spheres with varying metalness/roughness](https://codesandbox.io/s/instanceduniformsmesh-r3f-lss90?file=/src/index.js) (uses [react-three-fiber](https://github.com/pmndrs/react-three-fiber))

- [Instanced beziers with varying control points](https://ibyou.csb.app/) (plain Three.js + [BezierMesh](https://github.com/protectwise/troika/tree/master/packages/troika-three-utils#beziermesh))
