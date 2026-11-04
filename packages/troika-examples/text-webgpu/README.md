# Troika Text - WebGPU

A standalone example of `troika-three-text/webgpu` on Three.js's `WebGPURenderer`.

It lives outside the main examples bundle because `troika-examples` is on a version of
Three.js that predates `three/webgpu`. It loads Three.js from a CDN and troika from this
repo's sources, so it always runs the current code.

To run it, serve the repository root with any static file server, for example:

```sh
npx http-server -c-1
```

then open `/packages/troika-examples/text-webgpu/`. Add `?webgl` to run `WebGPURenderer` on
its WebGL 2 backend. WebGPU needs a secure context: `localhost` works, a LAN IP over http
does not.
