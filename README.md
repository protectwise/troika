# Troika JS

Troika is a collection of JavaScript tools for creating interactive graphics in the browser, with a focus on 3D/WebGL, and optimized for data visualization use cases.

The provided tools fall into two main categories:

- The [_Troika Framework_](https://protectwise.github.io/troika/#troika-framework), a fully featured framework for managing entire scenes with rich interactivity and high performance, and
- A growing set of [_other tools for Three.js_](https://protectwise.github.io/troika/#troika-threejs-tools), that do not depend on that framework.

The Troika project's main goal is to take aspects of developing interactive graphics that you almost always need, but are difficult to manage yourself, and make them as easy as possible.

[![3D Bar Chart Example](./docs/images/city-thumbnail.png)](https://troika-examples.netlify.com/#citygrid)
[![Layered Timeline](./docs/images/globe-connections-thumbnail.png)](https://troika-examples.netlify.app/#globeConnections)
[![ProtectWise: Protocol Threat Graph](./docs/images/pw-protocol-threats-thumbnail.png)](https://twitter.com/lojjic/status/1360290173427322883)
[![3D Text Rendering](./docs/images/text-thumbnail.png)](https://troika-examples.netlify.com/#text)
[![GPU Instancing](./docs/images/instancing-thumbnail.png)](https://troika-examples.netlify.com/#instanceable)
[![Layered Timeline](./docs/images/layered-timeline-thumbnail.png)](https://twitter.com/lojjic/status/1357102689210019844)

---

**[View the Troika Documentation](https://protectwise.github.io/troika)**

---

![Build Status](https://github.com/protectwise/troika/workflows/Continuous%20Integration/badge.svg?branch=master)

[![Netlify Status](https://api.netlify.com/api/v1/badges/523722ef-0c71-4bdc-935d-575c73ec1838/deploy-status)](https://app.netlify.com/sites/troika-examples/deploys)

## Development

This repository is a **Lerna monorepo** with 13 packages. For the best development experience, use the **VS Code multi-root workspace**:

```bash
# Clone the repository
git clone https://github.com/protectwise/troika.git
cd troika

# Install dependencies and bootstrap packages
npm install

# Open in VS Code with workspace configuration
code troika.code-workspace
```

### Why Use the Workspace?

- **Per-package IntelliSense** with correct import resolution
- **Build/test tasks** accessible via Ctrl+Shift+B / Ctrl+Shift+T
- **Debugging configs** for Jest tests and Examples dev server
- **Organized sidebar** with emoji-labeled package folders

See [VS_CODE_WORKSPACE_GUIDE.md](./VS_CODE_WORKSPACE_GUIDE.md) for full details.

### Build and Test

```bash
# Build all packages
npm run build

# Build examples
npm run build-examples

# Run tests
npm test

# Run examples dev server
npm run examples
```

See [BUILD_NOTES.md](./BUILD_NOTES.md) for release process and publishing.
