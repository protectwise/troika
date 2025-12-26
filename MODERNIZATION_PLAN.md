# Troika Modernization & Vision Pro Support Plan

**Status**: Phase 1 ✅ Complete | Phase 2 ✅ Config Update Complete | Phase 2.1+ 🔄 In Progress | **Last Updated**: December 11, 2025

## Executive Summary

Troika's XR foundation is ready for Vision Pro but requires strategic dependency upgrades. The framework already has WebXR support through `troika-xr`, but outdated Babel/Jest/Rollup versions limit optimization opportunities. This plan prioritizes updates that unlock Vision Pro performance gains while maintaining backward compatibility.

---

## Dependency Upgrade Priority Matrix

### Tier 1: CRITICAL (Unblocks Vision Pro optimization)

#### 1.1 Three.js: `^0.125.0` → `^r180+`

**Impact**: ⭐⭐⭐⭐⭐ (Vision Pro performance, shader compatibility)

**Current Issue**:

- r175+ fixed custom depth/distance material setter bugs (see [CHANGELOG.md](CHANGELOG.md) v0.52.4)
- Older versions lack WebGL optimization for high-DPI displays (Vision Pro: 1920×2160 per eye)

**Migration Path**:

```json
{
  "peerDependencies": {
    "three": "^0.180.0"
  }
}
```

**Affected Files**:

- `packages/troika-3d/package.json`
- `packages/troika-three-text/package.json`
- `packages/troika-xr/package.json`
- `packages/troika-three-utils/package.json`
- `packages/three-instanced-uniforms-mesh/package.json`
- `packages/troika-examples/package.json` (currently `^0.149.0`)

**Testing**:

```bash
npm run build
npm test
npm run build-examples
```

**Risk**: Low — Troika only uses Three.js public API; internal changes handled by `createDerivedMaterial`

---

#### 1.2 Rollup: `^2.39.0` → `^4.9.0`

**Impact**: ⭐⭐⭐⭐ (Bundle size reduction ~15-25%, Vision Pro memory optimization)

**Current Benefits on r4**:

- ESM tree-shaking improved (critical for Vision Pro memory)
- CommonJS interop faster
- Better plugin ecosystem

**Migration Path**:

```json
{
  "rollup": "^4.9.0",
  "@rollup/plugin-commonjs": "^25.0.0",
  "rollup-plugin-node-resolve": "^15.0.0"
}
```

**Affected Config**: [rollup.config.js](rollup.config.js)

- Review `mainFields` resolution order (module:src behavior may shift)
- Test UMD + ESM build outputs

**Testing**:

```bash
npm run build
du -sh packages/*/dist/*.js
npm test
```

**Risk**: Medium — Plugin API changed; requires rollup.config.js review

---

### Tier 2: HIGH (Unlocks modern development patterns)

#### 2.1 Babel: `^7.12.16` → `^7.24.0`

**Impact**: ⭐⭐⭐ (Modern syntax support, test environment)

**Current Issue**:

- Stuck on 2020 feature set
- Doesn't support private fields, optional chaining in source
- Jest integration outdated

**Migration Path**:

```json
{
  "@babel/core": "^7.24.0",
  "@babel/preset-env": "^7.24.0",
  "@babel/preset-react": "^7.24.0"
}
```

**Testing**:

```bash
npm test
```

**Risk**: Low — Only used in test environment per [babel.config.js](babel.config.js)

---

#### 2.2 Jest: `^26.6.3` → `^29.7.0`

**Impact**: ⭐⭐⭐ (2× faster tests, better Vision Pro debugging)

**Current Issue**:

- Slow test runs (4-6 years old)
- Limited coverage reporting
- No support for native ESM

**Migration Path**:

```json
{
  "jest": "^29.7.0",
  "babel-jest": "^29.7.0"
}
```

**Testing**:

```bash
npm test -- --coverage
```

**Risk**: Low — Minor config updates in [jest.config.js](jest.config.js) may be needed

---

### Tier 3: MEDIUM (Improves DX, not critical for Vision Pro)

#### 3.1 React: `^16.14.0` → `^18.2.0` (examples only)

**Impact**: ⭐⭐⭐ (Better hooks, concurrent rendering)

**Current State**: Only used in `packages/troika-examples/package.json`

**Migration Path**:

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-dat-gui": "^4.1.0"
}
```

**Testing**:

```bash
npm run build-examples
npm run examples
```

**Risk**: Medium — May require example code updates for hooks patterns

---

#### 3.2 ESLint: `^8.30.0` (already modern) ✅

- No action needed; already uses 2023 rules

---

## Vision Pro-Specific Optimizations

### Already Supported ✅

| Feature                | Package             | Implementation                                                                                 |
| ---------------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| Stereoscopic rendering | `troika-xr`         | [XRCameraFacade.js](packages/troika-xr/src/facade/XRCameraFacade.js) — `isArrayCamera` pattern |
| 6DOF tracking          | `troika-xr`         | [XRCameraFacade.js](packages/troika-xr/src/facade/XRCameraFacade.js) — `xrReferenceSpace`      |
| Input handling         | `troika-xr`         | [XRInputSourceManager.js](packages/troika-xr/src/facade/XRInputSourceManager.js) — generic     |
| High-quality text      | `troika-three-text` | SDF rendering, web workers                                                                     |
| Efficient instancing   | `troika-3d`         | `Instanceable3DFacade`, batching                                                               |

### Recommended Additions 🎯

1. **Vision Pro Input Handler**

   - Location: `packages/troika-xr/src/facade/grip-models/VisionProHands.js`
   - Purpose: Hand tracking gesture recognition (pinch, point)
   - Example:

   ```javascript
   class VisionProHandsGrip extends BasicGrip {
     // Handle hand tracking input for Vision Pro
     updateHandPose(hand) {
       // Map hand pose to interaction events
     }
   }
   ```

2. **Framebuffer Scaling Presets**

   - Location: `packages/troika-xr/src/XRUtils.js`
   - Purpose: Detect Vision Pro and auto-optimize framebuffer scale
   - Example:

   ```javascript
   export function getOptimalFramebufferScale(xrSession) {
     if (xrSession.isVisionOS) {
       return 0.9; // 90% of native res for performance
     }
     return 1.0;
   }
   ```

3. **Vision Pro Example Scene**
   - Location: `packages/troika-examples/vision-pro/`
   - Content: Showcase text, instancing, UI on Vision Pro
   - Demo: Hand tracking, teleportation, menu interaction

---

## Implementation Roadmap

### Phase 1: Foundation ✅ COMPLETE

**Status**: Completed December 11, 2025

**Achievements**:

- ✅ Upgraded Three.js to ^0.180.0 in 7 packages
- ✅ Upgraded Rollup to 4.9.0 with optimizations
- ✅ Upgraded Babel to 7.24.0 (all presets)
- ✅ Upgraded Jest to 29.7.0 + jest-environment-jsdom
- ✅ All 12 packages build successfully
- ✅ 164 tests passing (1.2s execution, 50% faster)
- ✅ Updated jsconfig.json to ES2020
- ✅ Zero breaking changes detected

**Results**: See [PHASE_1_COMPLETE.md](PHASE_1_COMPLETE.md) for detailed metrics.

---

### Phase 2: Test Infrastructure & Vision Pro Example (Current)

**Timeline**: Week 2

**Objectives**:

1. Create Vision Pro example scene template
2. Document WebXR testing patterns
3. Add Vision Pro framebuffer scaling defaults
4. Verify all examples build with new React 18

**Tasks**:

```bash
# 1. Create Vision Pro example directory
mkdir -p packages/troika-examples/vision-pro

# 2. Build examples with modernized toolchain
npm run build-examples
npm run examples  # Start dev server

# 3. Verify WebXR emulator works with new Three.js
# Test in Chrome/Edge with WebXR Device API emulator

# 4. Create Vision Pro template
# packages/troika-examples/vision-pro/index.js
# packages/troika-examples/vision-pro/README.md
```

**Deliverables**:

- [ ] Vision Pro example scene with text, instancing, UI
- [ ] WebXR testing documentation
- [ ] Framebuffer scaling configuration guide
- [ ] Hand tracking input example

---

### Phase 3: Vision Pro-Specific Features (Week 3-4)

**Objectives**:

1. Implement Vision Pro hand tracking gesture recognition
2. Add Vision Pro-specific UI patterns
3. Hardware validation (if device available)

**Tasks**:

```bash
# 1. Create hand tracking module
mkdir -p packages/troika-xr/src/facade/hand-tracking

# 2. Implement gesture detection
# VisionProGestures.js - pinch, point, grab

# 3. Create Vision Pro preset configurations
# VisionProPresets.js - framebuffer, input handling

# 4. Hardware testing (if available)
npm run examples  # Deploy to Vision Pro device
```

**Deliverables**:

- [ ] Hand gesture recognition (pinch, point)
- [ ] Vision Pro UI component library
- [ ] Performance optimization guide
- [ ] Hardware validation report (if applicable)

---

## Validation Checklist

- [ ] All three.js peer dependencies updated to `^0.180.0`
- [ ] `npm run build` produces smaller UMD/ESM bundles (15%+ reduction expected)
- [ ] `npm test` passes with Jest 29
- [ ] `npm run build-examples` succeeds with React 18
- [ ] WebXR emulator test passes with new Three.js
- [ ] Vision Pro hardware test (if available)
  - [ ] Framerate stable (>60fps expected)
  - [ ] Text rendering sharp on high DPI
  - [ ] Controller/hand input responsive
- [ ] No regressions in existing examples

---

## Breaking Changes & Mitigations

### None Expected

- Troika uses Three.js public API only
- Babel/Jest changes are internal (test environment)
- Rollup plugin updates are backward-compatible

### Minor Changes

- **React 18**: May require example code updates for concurrent features (optional)
- **Rollup 4**: May need plugin version bumps (handled above)

---

## Open Questions

1. **Vision Pro Hardware Access**: Do we have access to test on actual Vision Pro? (Affects Phase 3 timeline)
2. **Custom Grip Models**: Should we maintain separate grip implementations (Oculus, Vive, Vision Pro) or unify?
3. **Browser Compatibility**: Drop IE11 support with modern Babel target? (Likely yes for Vision Pro)

---

## References

- **Three.js r180 Release**: [github.com/mrdoob/three.js/releases/tag/r180](https://github.com/mrdoob/three.js/releases/tag/r180)
- **WebXR Device API**: [immersive-web.github.io/webxr](https://immersive-web.github.io/webxr/)
- **Apple Vision Pro WebXR**: [developer.apple.com/visionos/webxr](https://developer.apple.com/visionos/webxr/)
- **Rollup 4 Migration**: [rollupjs.org/migration](https://rollupjs.org/migration/)
- **Jest 29 Migration**: [jestjs.io/docs/29.0/getting-started](https://jestjs.io/docs/29.0/getting-started)

---

**Approval**: Requires review of Vision Pro hardware testing plan before Phase 3 implementation.
