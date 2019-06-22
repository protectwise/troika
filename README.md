# Troika 

Troika is a JavaScript framework that simplifies the creation of interactive graphics in the browser, with a focus on 3D/WebGL, and optimized toward data visualization and user interface development.

It provides:

* A component architecture that encapsulates complex graphics APIs behind simple facade objects
* Declarative point-in-time description of your scene's structure
* CSS-like declarative animations and transitions
* DOM-like interaction event handling
* Tools for automatic and manual performance optimization

Developing interactive 3D and 2D graphics should be as straighforward as developing HTML+CSS+JavaScript interfaces. Troika aims to make that a reality.

## Project Status

Troika was developed starting in 2016 by the [ProtectWise](https://protectwise.com) front end engineering team as an internal tool to enable rapid development of interactive 3D and 2D data visualizations in the ProtectWise Visualizer. As it matured and became an essential part of our toolkit, we realized it could be useful to the broader web developer community and decided to release it as an open source project.

Our initial public release can be considered mature/stable enough to use in production code. However you will find that documentation is still very incomplete. We're working on improving that, and you can see [the documentation](./docs/overview.md) that we have so far. We also recommend checking out the [examples source code](./packages/troika-examples) and the inline code documentation for the [core facade classes](./packages/troika-core/src/facade/) as good places to start.


----

[![Build Status](https://travis-ci.org/protectwise/troika.svg?branch=master)](https://travis-ci.org/protectwise/troika)