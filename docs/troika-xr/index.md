---
id: 3d-webxr
title: WebXR
---

The `troika-xr` package adds WebXR capabilities to `troika-3d` scenes. These capabilities include:

- UI for launching a WebXR session
- Stereoscopic camera rendering
- 6DoF head tracking
- Controller tracking with pointer raycasting integrated into the main event system
- A few basic helper facades for things like teleportation and menus

> Note: while definitely usable, this package is still somewhat lacking in configurability and features. Requests and contributions are welcome.

## Usage

The `troika-xr` package must be installed in addition to `troika-3d`.

Currently, the only provided entry point for WebXR support is via a React [higher-order component](https://reactjs.org/docs/higher-order-components.html) named `ReactXRAware`. This assumes that your Troika scene uses the `Canvas3D` React component as its entry point, which itself is managed by some parent React component.

To inject WebXR support, you need to use the `ReactXRAware` HOC to wrap that _parent_ React component. The HOC function can also be passed several config properties to customize the XR session it will create. (TODO add details here or link to the source code JSDoc...)

> Note: The HOC must wrap the `Canvas3D`'s _parent_ rather than the `Canvas3D` directly because it is going to provide you with a UI button for launching the XR session, which you must place into the DOM _outside_ the canvas.

The wrapped React component will now be provided with a few new props for you to use:

- `xrSupported` - a boolean indicating any level of browser support for WebXR.
- `xrSupportedSessionModes` - an array of supported XR session modes (currently "inline" and/or "immersive-vr").
- `xrSession` - a reference to the `XRSession` object when an XR session is active, or `null` when there is no active session. You can use this to customize content based on whether the user is in XR or not.
- `xrSessionMode` - the current session mode when an XR session is active (currently "inline" or "immersive-vr").
- `xrReferenceSpace` - a reference to the current `XRReferenceSpace` when an XR session is active, or `null` otherwise.
- `xrReferenceSpaceType` - the current [reference space type](https://immersive-web.github.io/webxr/#enumdef-xrreferencespacetype) ("bounded-floor" etc.).
- `xrLauncher` - a React element that you should place into your render function, which provides the user a UI button for launching their WebXR session.

## Example HOC Setup

```js
import { ReactXRAware } from './XRAware.js'

class App extends React.Component {
  render() {
    return <div className="my_app">
      <Canvas3D
        camera={{
          // Camera x/y/z/etc. set here controls its base world position, and
          // headset 6DoF tracking will be applied relative to that.
        }}
        objects={[
          this.props.xrSession ? {
            // some object that is only present in XR
          } : null,
          
          //...other scene objects
        ]}
      />
      
      {
        // This is the button that lets the user launch into XR!
        this.props.xrLauncher
      }
    </div>
  }
}

export const XRApp = ReactXRAware(App, {
  //...XR options
})
```


## Interaction Events

When in an XR session, hand controllers will be automatically added to the scene and be synchronized to their `XRInputSource` positions.

> NOTE: rendering of controllers is currently very basic, with only Oculus controllers and a very basic fallback model. [Integration of more controller types](https://github.com/protectwise/troika/issues/29) is planned.

XRInputSources that provide a target ray will automatically be used to raycast objects in the scene, and hits will be mapped to normal pointer events (mouseover/mousemove/drag/etc.) just like on screen. Likewise, controller buttons will map to mousedown/up/click events, and thumbsticks will map to wheel events. This lets you define your events the same way for screens and XR, for the most part.

While these events won't have screen-specific properties like `clientX`, they will always carry a `ray` property holding the `THREE.Ray` that triggered the hit. (That's also true for all events in non-XR `troika-3d`, so it's usually safer to use the `ray` than things like `clientX`.)

Additionally, each event will have a `eventSource` property holding a reference to the `XRInputSource` facade that triggered it. This allows you to distinguish which pointer fired an event when you have two hands pointing at different things. 



