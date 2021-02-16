---
id: 3d-text
title: 3D Text
---

The `troika-3d-text` package provides a `Text3DFacade` for high quality text rendering in Troika 3D scenes, using signed distance fields (SDF) and antialiasing using standard derivatives.

The bulk of its implementation has been extracted to the [`troika-three-text`](../troika-three-text/index.md) package which allows it to be used in any Three.js project without any Troika framework dependencies. For the most part `Text3DFacade` is a passthrough to a `Text` object from that package. See the [troika-three-text docs](../troika-three-text/index.md) for the available properties, all of which can be set on `Text3DFacade`.

```js
import { Text3DFacade } from 'troika-3d-text'

{
  key: 'text',
  facade: Text3DFacade,
  font: 'https://url/of/font.woff',
  text: 'Hello World!',
  fontSize: 0.1,
  color: 0xccccff
  //...other props
}
```

This text rendering engine is also used by the `troika-3d-ui` package to perform text layout measurements for flexbox layout as well as the final rendering.
