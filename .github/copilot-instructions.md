# Troika AI Agent Instructions

## Project Overview

**Troika** is a JavaScript monorepo for interactive 3D/2D graphics in the browser, built on Three.js. It's a **Facade-based framework** where the core abstraction is declarative scene descriptors that map to Three.js objects.

### Key Architecture Concept: Facade Pattern

The entire framework centers on `Facade` classes ([troika-core/src/facade/Facade.js](../packages/troika-core/src/facade/Facade.js)):

- **Facades** wrap Three.js objects and receive property assignments from scene descriptors
- **Scene Descriptors** are plain JS objects with a `facade` property (class reference) and optional `key` for identity
- **Lifecycle**: constructor → property updates via setters → `afterUpdate()` → destructor
- All updates, animations, transitions, and interactions flow through this abstraction

Example pattern:

```javascript
// Descriptor (plain object)
{ facade: Group3DFacade, x: 10, y: 20, children: [...] }

// Corresponding facade class extends Facade
class Group3DFacade extends ParentFacade { /* ... */ }
```

## Monorepo Structure (Lerna-managed)

- **Core**: `packages/troika-core/` — Facade system, World, animations, transitions, pointer events
- **3D Framework**: `packages/troika-3d/` — Scene3D, Object3D facades, cameras, lights, primitives
- **2D Framework**: `packages/troika-2d/` — Canvas-based 2D equivalents
- **Specialized Tools**:
  - `troika-three-text/` — High-quality SDF text rendering (uses web workers)
  - `troika-three-utils/` — Shader utilities, BezierMesh, material derivation
  - `troika-flex-layout/` — Yoga-based flexbox (compiled from C via Emscripten)
  - `troika-3d-ui/` — Interactive 2D UI panels in 3D scenes (flexbox-based)
  - `troika-xr/` — WebXR support
- **Examples**: `packages/troika-examples/` — Demonstrates all frameworks (isolated from main build)

### Cross-Package Dependencies

Sibling packages are treated as **external** in rollup builds. Import paths are transparent:

```javascript
import { Facade } from "troika-core";
import { World3DFacade } from "troika-3d";
```

Rollup config auto-detects sibling packages and excludes them from bundling.

## Development Workflows

### Install & Bootstrap

```bash
npm install         # Installs root + runs postinstall hook
npm run bootstrap   # Runs: lerna bootstrap --hoist (symlinks sibling packages)
```

### Build

```bash
npm run build       # Builds all packages except troika-examples via rollup
npm run build-examples  # Builds troika-examples separately (needs Bootstrap first)
```

**Why separate?** Examples depend on compiled packages and must build last. Uses custom [rollup.config.examples.js](../packages/troika-examples/rollup.config.examples.js).

### Test

```bash
npm test            # Jest across all packages
npm test -- --watch # Watch mode
```

**Test config**: [jest.config.js](../jest.config.js) includes:

- `collectCoverage: true` by default for coverage reporting
- `moduleNameMapper` that redirects package imports to source (`src/index.js`) instead of UMD builds (critical for Node.js test environment)
- `testEnvironment: "jsdom"` for DOM simulation in tests

**VS Code Integration**: The Jest extension is pre-configured in [troika.code-workspace](../troika.code-workspace):

- Run tests directly from the VS Code Test Explorer (file sidebar)
- Hover over tests to see pass/fail status
- Use "Run", "Debug", or "Run All" buttons in the test explorer
- Keyboard shortcut: `Cmd+Shift+T` to toggle test explorer

### Build Artifacts

- **UMD**: `dist/<package>.umd.js` (for CDN/browser)
- **ESM**: `dist/<package>.esm.js` (for modules, tree-shakeable)
- **Source**: `src/index.js` via `module:src` field (direct import during dev)

## Facade & Descriptor Conventions

### Special Descriptor Properties

| Property        | Purpose                                                 | Example                                         |
| --------------- | ------------------------------------------------------- | ----------------------------------------------- |
| `facade`        | **Required** facade class                               | `facade: Group3DFacade`                         |
| `key`           | Unique identifier (siblings); if omitted, auto-assigned | `key: 'camera-main'`                            |
| `children`      | ParentFacade only; array of descriptors                 | `children: [...]`                               |
| `ref`           | Callback(facade) on mount, callback(null) on unmount    | `ref: (inst) => this.camera = inst`             |
| `transition`    | Smoothly animate property changes                       | `transition: { x: 500, y: 500 }`                |
| `animation`     | Keyframe animations                                     | `animation: [{ t: 0, x: 0 }, { t: 1, x: 100 }]` |
| `exitAnimation` | Play on removal                                         | `exitAnimation: {...}`                          |
| `pointerStates` | Override props on hover/active                          | `pointerStates: { hover: { color: 0xff0000 } }` |

### Facade Subclasses

- **Facade** — Base class, minimal
- **ParentFacade** — Manages `children` descriptor array
- **PointerEventTarget** — Adds pointer events (hover, click, drag)
- **Object3DFacade** (troika-3d) — Wraps Three.js Object3D; handles transforms, layers, raycasting
- **World3DFacade** (troika-3d) — Root facade managing renderer, camera, scene; handles event dispatch

### Setters vs afterUpdate()

- **Setters**: Handle immediate sync to three.js object (e.g., `set position(p) { this.threeObject.position.copy(p) }`)
- **afterUpdate()**: Batch multi-property logic after all props assigned (e.g., rebuild mesh if geometry or material changed)

## Key Patterns & Gotchas

### 1. **Instancing System** (High-Performance)

Troika auto-batches similar geometries with `Instanceable3DFacade` + `InstancingManager`. When many objects share geometry/material, they're merged into a single buffered draw call.

- **Don't** manually add to scene if facade handles it
- **Do** extend `Instanceable3DFacade` for objects that benefit from batching

### 2. **Three.js Version Pinning**

- Peer dependency: `three@>=0.125.0`
- Check [CHANGELOG.md](../CHANGELOG.md) for THREE version compatibility issues (recent: material setters in r175)
- Use `createDerivedMaterial` (troika-three-utils) for shader patching, not material inheritance

### 3. **Web Workers**

`troika-three-text` offloads font parsing, SDF generation, and glyph layout to a worker.

- **Sync call**: `myText.sync()` waits for worker; otherwise runs on next frame
- Worker code is bundled; no manual worker imports needed

### 4. **Matrix Updates**

Object3D facades set `matrixAutoUpdate = false` and manage transforms manually (better performance).

- Don't manually call `updateMatrix()` if using position/quaternion setters

### 5. **Scene Descriptors ≠ JSX Equivalent**

JSX wrapper syntax exists but has overhead (createElement calls, prop allocation). For large dynamic scenes, prefer plain descriptor objects.

## Testing & Debugging

### Test Structure

- `packages/*/` contain `__tests__` folders (Jest auto-discovers)
- Example: `packages/troika-core/__tests__/facade/` for facade tests
- Use `ref` in descriptors to inspect facade instances in tests

### Running Tests

**Command line:**

```bash
npm test                    # Run all tests
npm test -- --watch         # Watch mode (re-run on file changes)
npm test -- --coverage      # Generate coverage report
npm test -- troika-core     # Run tests for specific package
```

**VS Code Test Explorer:**

1. Open the Test Explorer from the sidebar (beaker icon)
2. Browse test files organized by package
3. Click the play icon to run individual tests
4. Click the debug icon to debug tests with breakpoints
5. Filter tests by name using the search box

### Debugging Tips

- **World3DFacade**: Provides `.world` property to inspect render queue, facade tree
- **Three.js Inspector**: Browser console `scene.children` to inspect object hierarchy
- **Coverage**: Run `npm test -- --coverage` to see which paths lack tests
- **Debug breakpoints**: Use VS Code's debug configuration "Jest Current File" or "Jest All" to set breakpoints and step through tests

### Important Test Configuration Notes

- **Module Resolution**: `jest.config.js` uses `moduleNameMapper` to redirect all troika package imports to their source files (`src/index.js`), not UMD builds. This is essential because:
  - UMD builds assume browser globals like `window` which don't exist in Node.js
  - Source files use ES modules which Jest transforms via Babel
- **Babel Transformation**: [babel.config.js](../babel.config.js) transforms JSX and modern JavaScript for Jest:
  - Uses `@babel/preset-env` for JavaScript compatibility
  - Uses `@babel/preset-react` for JSX support
  - Caches config using `api.cache.using()`
- **React 19 Compatibility**: The `isReactElement()` utility in [troika-core/src/utils.js](../packages/troika-core/src/utils.js) detects both:
  - React <19: `Symbol(react.element)`
  - React 19+: `Symbol(react.transitional.element)`

### Local Development

- After changes, run `npm run build` to populate `dist/` folders
- Import via `module:src` field (package.json) points to unbuilt source during development
- For examples: `npm run examples` starts dev server with HMR

### VS Code Setup

The workspace is pre-configured with:

**Launch Configurations** (`../.vscode/launch.json`):

- `Jest Current File` - Debug current test file with breakpoints
- `Jest All` - Debug entire test suite
- `Node Attach` - Attach to running Node process
- `Chrome Attach` - Attach to Chrome for browser debugging

**Tasks** (`../.vscode/tasks.json`):

- `npm: Build All Packages` - Build entire monorepo
- `npm: Build Examples` - Build examples separately
- `npm: Test All` - Run full test suite
- `npm: Lint All` - Run ESLint across all packages
- `npm: Run Examples Dev Server` - Start dev server for examples
- `npm: Bootstrap (Lerna)` - Install and link sibling packages

**Settings** (`../.vscode/settings.json`):

- Automatic ESLint fixing on save
- Prettier formatting for JS/JSON/Markdown
- Jest extension configured for test discovery and execution

**Workspace Configuration** (`../troika.code-workspace`):

- Single root folder configuration for proper Jest extension integration
- Pre-configured Jest settings with `npm test` command
- Recommended VS Code extensions listed

## Versioning & Publishing

This project uses **Lerna** with **Conventional Commits** for automated versioning.

- **Commit format**: `feat(scope): message` / `fix(scope): message` / `BREAKING CHANGE: ...`
- **Version workflow**:
  ```bash
  npm run build && npm run test && npm run lint && npm run build-examples
  npx lerna version  # Prompts for semver, updates all package.json files, creates git tag
  npx lerna publish from-git  # Publishes to NPM (must be logged in)
  ```

## File Organization Conventions

- **src/index.js** — Public API exports (re-exports key facades, utils)
- **src/facade/** — Facade class definitions
- **src/react/** — React component wrappers (CanvasBase, Canvas3D)
- **src/utils.js** — Shared utilities (assign, forOwn, etc.)
- **CHANGELOG.md** (per-package) — Release notes (auto-generated by Lerna)
- **README.md** (per-package) — Usage docs, property reference

## Common Tasks

| Task                            | Command                                                                        | Notes                                          |
| ------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- |
| Add a new facade                | Create `src/facade/MyFacade.js`, export from `src/index.js`                    | Extend Facade or ParentFacade                  |
| Add a Three.js material variant | Use `createDerivedMaterial` (troika-three-utils)                               | Patches shader without inheritance             |
| Build a new package             | Copy template from existing package; ensure `rollup.config.js` in root is used | Update lerna.json if not in `packages/*`       |
| Fix cross-package issue         | Modify source, run `npm run build`, test                                       | Sibling imports work transparently after build |
| Debug memory leaks              | Call `.dispose()` on Three.js objects; implement `destructor()` in facades     | Lerna symlinks may hide cleanup issues         |

## Modernization & Vision Pro Support

### Current Stack Versions (⚠️ Requires Updates)

- **Three.js**: `^0.125.0` (min) / `^0.149.0` (examples) — **UPDATE TO**: `r180+` for Vision Pro optimization
- **Babel**: `^7.12.x` — **UPDATE TO**: `^7.24.x` (2024-current)
- **React**: `^16.14.0` (examples only) — **UPDATE TO**: `^18.x` for hooks/concurrent rendering
- **Jest**: `^26.6.3` — **UPDATE TO**: `^29.x+`
- **Rollup**: `^2.39.0` — **UPDATE TO**: `^4.x`
- **Lerna**: `^4.0.0` — **Status**: Good for monorepo management

### Apple Vision Pro Capabilities

The `troika-xr` package already supports WebXR via [XRCameraFacade.js](../packages/troika-xr/src/facade/XRCameraFacade.js) and [WorldXRFacade.js](../packages/troika-xr/src/facade/WorldXRFacade.js), which provide:

- Stereoscopic rendering via `isArrayCamera` with per-view cameras
- 6DOF head tracking with `xrReferenceSpace` management
- Controller input via `XRInputSourceManager`
- Dynamic framebuffer scaling with `xrFramebufferScaleFactor`

### Vision Pro Modernization Path

#### Priority 1: Three.js r180+ (WebGL improvements, Vision Pro optimization)

- **Action**: Update `peerDependencies` in core packages from `^0.125.0` → `^0.175.0` (minimum r175 has material setter fixes tracked in [CHANGELOG.md](../CHANGELOG.md))
- **Files affected**:
  - `packages/troika-3d/package.json`
  - `packages/troika-three-text/package.json`
  - `packages/troika-xr/package.json`
  - `packages/troika-three-utils/package.json`
  - `packages/three-instanced-uniforms-mesh/package.json`
- **Compatibility test**: Run `npm test` after bumping; check shader compilation on Vision Pro hardware if available
- **Key fix**: r175+ resolves custom depth/distance material setter issues ([Issue #357](https://github.com/protectwise/troika/issues/357))

#### Priority 2: Babel 7.24+ (ES2024 support)

- **Action**: Update `@babel/core` and presets in [package.json](../package.json)
  ```json
  "@babel/core": "^7.24.0",
  "@babel/preset-env": "^7.24.0",
  "@babel/preset-react": "^7.24.0"
  ```
- **Impact**: Enables optional chaining, nullish coalescing in source (already in output via Buble)
- **No breaking changes** for Troika codebase

#### Priority 3: Jest 29+ (faster testing, better error output)

- **Action**: Update `jest` in [package.json](../package.json)
  ```json
  "jest": "^29.7.0",
  "babel-jest": "^29.7.0"
  ```
- **Test**: Run `npm test` to verify all suites pass

#### Priority 4: Rollup 4.x (better tree-shaking, Vision Pro module optimization)

- **Action**: Update rollup and plugins in [package.json](../package.json)
  ```json
  "rollup": "^4.9.0",
  "@rollup/plugin-commonjs": "^25.0.0"
  ```
- **Impact**: Smaller bundle sizes, better ES module support
- **Note**: May require minor config updates in [rollup.config.js](../rollup.config.js)

#### Priority 5: React 18 (examples only, concurrent rendering)

- **Action**: Update in `packages/troika-examples/package.json`:
  ```json
  "react": "^18.2.0",
  "react-dom": "^18.2.0"
  ```
- **Breaking change**: May need `StrictMode` adjustments in examples
- **Benefit**: Hooks-based patterns, better mobile/Vision Pro performance

### Vision Pro-Specific Considerations

1. **Framebuffer Scaling**: Vision Pro uses dual 1920×2160 per-eye displays. Adjust via:

   ```javascript
   xrFramebufferScaleFactor: 1.0; // Full resolution; adjust down for performance
   ```

2. **Input Handling**: Vision Pro uses hand tracking (not controllers). Current code supports:

   - [XRInputSourceManager.js](../packages/troika-xr/src/facade/XRInputSourceManager.js) handles generic input sources
   - Add Vision Pro-specific grip models in `packages/troika-xr/src/facade/grip-models/` if needed

3. **Text Rendering**: `troika-three-text` SDF rendering is ideal for Vision Pro's high pixel density

   - No changes needed; already optimized

4. **Material Compatibility**: Use `createDerivedMaterial` (not inheritance) to ensure Vision Pro shader compatibility

### Deprecation Warnings to Address

- **`rollup-plugin-buble`**: Still used for transpilation; consider migrating to `swc` for speed (future enhancement)
- **`event-target-polyfill`**: May become unnecessary in future versions; check browser compatibility

### Testing Vision Pro Compatibility

1. **Local testing**: Use Chrome/Safari WebXR emulator

   ```bash
   # Install WebXR Device API emulator extension
   npm run examples  # test in immersive mode
   ```

2. **Hardware validation**: Test on actual Vision Pro device

   - Check framerate via `xrFrame.timestamp` tracking
   - Monitor memory with Safari DevTools (Vision Pro Safari dev mode)
   - Verify 6DOF tracking accuracy

3. **Bundle size check**: Ensure examples remain under Vision Pro memory constraints
   ```bash
   npm run build-examples
   # Check dist/examples-bundle.js size
   ```

## VisionOS CSS & UI Best Practices

VisionOS and iPadOS have distinct spatial interaction models and system UI requirements that affect web applications. The following CSS optimizations prevent common UX issues and improve the spatial experience.

### Critical CSS Requirements for VisionOS

#### 1. Safe Area Environment Variables

VisionOS windows have rounded corners and a system "grab bar" at the bottom. UI elements must be inset to prevent clipping or overlap.

```css
html,
body {
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(
      safe-area-inset-bottom
    ) env(safe-area-inset-left);
}
```

**Why**: Without this, interactive elements (buttons, text) may be hidden behind the grab bar or clipped by window edges, making them inaccessible via eye-gaze + pinch.

#### 2. Overscroll Prevention

Canvas-based apps often intercept pointer/touch events near screen edges. Without `overscroll-behavior: none`, VisionOS/iPadOS will "rubber-band" (bounce) the entire web page, breaking the interaction.

```css
body,
canvas {
  overscroll-behavior: none;
}
```

**Why**: VisionOS interprets edge gestures as "scroll dashboard" by default. Disabling overscroll prevents the page from bouncing and consuming your custom input events.

#### 3. Text Size Lock

Safari on VisionOS/iPadOS automatically scales text when the device rotates or window resizes. This breaks carefully-crafted UI layouts.

```css
html {
  -webkit-text-size-adjust: 100%;
}
```

**Why**: Without this flag, text will grow unexpectedly, causing layout shifts and clipped UI elements when the app window resizes.

#### 4. Eye-Gaze Cursor Feedback

VisionOS uses a round dot cursor (eye-gaze position). Changing this to a crosshair on interactive elements provides visual feedback that the area responds to spatial input.

```css
canvas {
  cursor: crosshair; /* on hover */
}
```

**Why**: Users rely on cursor changes to know if an area is interactive. Without this, eye-gaze interaction feels unresponsive.

### Implementation

Use the **VisionOSPresets** utility for automatic CSS injection:

```javascript
import { injectVisionOSStyles, applyVisionOSPreset } from "troika-xr";

// Option 1: Inject all VisionOS styles
injectVisionOSStyles();

// Option 2: Apply a named preset
applyVisionOSPreset("visionPro"); // Full optimization
applyVisionOSPreset("iPad"); // iPad-specific settings
applyVisionOSPreset("desktop"); // Desktop fallback

// Option 3: Get CSS as string (for pre-rendering)
const css = getVisionOSStylesheet();
```

### Platform Detection

```javascript
import { isVisionOS, isiPadOS, getOptimalFramebufferScale } from "troika-xr";

if (isVisionOS()) {
  // Vision Pro-specific optimizations
  // e.g., use higher quality shaders, larger UI targets
}

if (isiPadOS()) {
  // iPad-specific code paths
  // e.g., adapt layout for smaller safe areas
}

// Get recommended framebuffer scale for current device
const scale = getOptimalFramebufferScale(xrSession);
// Vision Pro: 0.9 (1920×2160 per eye)
// iPad: 0.75-0.85 (varies by model)
// Desktop: 1.0
```

### Common Pitfalls

| Issue                    | Symptom                              | Solution                                     |
| ------------------------ | ------------------------------------ | -------------------------------------------- |
| Missing safe area insets | UI buttons hidden behind grab bar    | Add `env(safe-area-inset-*)` padding         |
| No overscroll prevention | Page bounces when drawing near edges | Set `overscroll-behavior: none` on canvas    |
| Missing text-size-adjust | Text grows when window resizes       | Add `-webkit-text-size-adjust: 100%`         |
| No cursor feedback       | Eye-gaze interaction feels broken    | Use `cursor: crosshair` on interactive areas |
| Canvas full-bleed layout | Safe areas ignored, UI clipped       | Apply safe area insets to canvas container   |

### Testing VisionOS CSS

1. **Local Testing** (Safari on Mac)

   ```bash
   # Use Safari's Responsive Design Mode
   # Simulate iPad Pro: Window size affects safe area behavior
   ```

2. **Device Testing** (iPad/Vision Pro)

   ```bash
   # Deploy to iPad: Check safe area insets visually
   # Deploy to Vision Pro: Verify grab bar doesn't clip UI
   npm run examples  # Test in Safari on device
   ```

3. **Validation Checklist**
   - [ ] UI elements not clipped by grab bar
   - [ ] Canvas interactions don't trigger page bounce
   - [ ] Text remains readable after window resize
   - [ ] Cursor changes on interactive areas
   - [ ] Safe areas work in both portrait/landscape

### References

- [VisionOS CSS Environment Variables](https://developer.apple.com/visionos/design/inputs-and-interaction/)
- [WebKit CSS Extensions for Spatial Apps](https://webkit.org/blog/14955/visionos-web-apps/)
- [MDN: overscroll-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior)
- [Apple Vision Pro Design Guidelines](https://developer.apple.com/visionos/design/)

---

## External Resources

- **Documentation**: https://protectwise.github.io/troika
- **Three.js Docs**: https://threejs.org/docs
- **Three.js WebXR**: https://threejs.org/examples/?q=webxr
- **WebXR Device API**: https://immersive-web.github.io/webxr/
- **Vision Pro WebXR**: https://developer.apple.com/visionos/webxr/
- **Lerna Docs**: https://lerna.js.org
- **Conventional Commits**: https://www.conventionalcommits.org
