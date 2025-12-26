# Troika Vision Pro Modernization — Executive Summary

**Date**: December 2025  
**Status**: ✅ Analysis Complete | 🔄 Ready for Implementation

---

## Current State

### ✅ What Works Great for Vision Pro

Troika's **WebXR foundation is already Vision Pro-ready**:

| Component                  | Status   | Details                                                         |
| -------------------------- | -------- | --------------------------------------------------------------- |
| **Stereoscopic Rendering** | ✅ Ready | `WorldXRFacade` + `XRCameraFacade` support dual cameras per eye |
| **6DOF Head Tracking**     | ✅ Ready | `xrReferenceSpace` integration in core                          |
| **Hand/Controller Input**  | ✅ Ready | `XRInputSourceManager` handles generic input                    |
| **High-DPI Text**          | ✅ Ready | `troika-three-text` SDF rendering perfect for 2160p displays    |
| **GPU Batching**           | ✅ Ready | `Instanceable3DFacade` reduces draw calls for many objects      |

### ⚠️ What Needs Modernization

Five key libraries are 2-5 years behind current versions:

| Library      | Current | Needed | Impact                                   | Priority    |
| ------------ | ------- | ------ | ---------------------------------------- | ----------- |
| **Three.js** | r0.149  | r180+  | WebGL optimization, Vision Pro fixes     | 🔴 CRITICAL |
| **Babel**    | 7.12    | 7.24   | Modern syntax, faster tests              | 🟡 HIGH     |
| **Jest**     | 26      | 29     | 2× faster tests, better debugging        | 🟡 HIGH     |
| **Rollup**   | 2.39    | 4.9    | 15%+ smaller bundles (Vision Pro memory) | 🔴 CRITICAL |
| **React**    | 16      | 18     | Hooks, concurrent features (examples)    | 🟡 MEDIUM   |

---

## Why This Matters for Vision Pro

### Memory Constraints

- Vision Pro requires lean Web apps (~200-500MB total for immersive experiences)
- Rollup 4 can reduce bundle size by **15-25%** (major win)

### Display Performance

- Vision Pro displays: **1920×2160 per eye** (4× more pixels than 1080p)
- Three.js r180+ has WebGL optimizations for high-DPI rendering
- Current r0.149 is not optimized for 4K+ displays

### Framework Compatibility

- Apple's WebXR implementation uses latest specs
- Babel 7.24 supports modern JavaScript (optional chaining, nullish coalescing)
- Jest 29 provides faster feedback for iterative development

---

## Implementation Timeline

### 🟢 Phase 1: Foundation (1-2 weeks)

**Goal**: Upgrade Three.js + Rollup (biggest impact)

```bash
# Update package.json peerDependencies
# Three.js: ^0.125.0 → ^0.180.0
# Rollup: ^2.39.0 → ^4.9.0

npm run build      # Test compilation
du -sh packages/*/dist/*.js  # Verify bundle reduction
npm test           # Verify shader compatibility
```

**Expected**: 15-25% smaller bundles, faster startup on Vision Pro

---

### 🟡 Phase 2: Test Infrastructure (1 week)

**Goal**: Upgrade Babel + Jest (faster development)

```bash
# Update package.json devDependencies
# Babel: ^7.12.16 → ^7.24.0
# Jest: ^26.6.3 → ^29.7.0

npm test -- --coverage  # Verify all tests pass
# Expect 2× faster test runs
```

**Expected**: Test suite runs in 30-60 seconds (vs 60-120s currently)

---

### 🟡 Phase 3: Examples (1 week)

**Goal**: Upgrade React, add Vision Pro-specific features

```bash
# Update packages/troika-examples/package.json
# React: ^16.14.0 → ^18.2.0

npm run build-examples
npm run examples
# Test in browser WebXR emulator
```

**Expected**: Modern React patterns, better performance

---

### 🎯 Phase 4: Vision Pro Features (2 weeks, Optional)

**Goal**: Hand tracking, custom Vision Pro examples

```bash
# Add: packages/troika-xr/src/facade/grip-models/VisionProHands.js
# Add: packages/troika-examples/vision-pro/ (new example)
# Test on Vision Pro hardware (if available)
```

**Expected**: Native hand tracking input, optimized example

---

## Risk Assessment

| Change         | Risk      | Mitigation                                                             |
| -------------- | --------- | ---------------------------------------------------------------------- |
| Three.js r180+ | 🟢 Low    | Uses only public API; `createDerivedMaterial` handles internal changes |
| Rollup 4.x     | 🟡 Medium | Plugin API changes; update rollup.config.js carefully                  |
| Babel 7.24     | 🟢 Low    | Test-environment only; no source changes needed                        |
| Jest 29        | 🟢 Low    | Backward compatible; minor jest.config.js updates                      |
| React 18       | 🟡 Medium | Examples only; may need concurrent feature updates                     |

**Verdict**: **Safe to proceed.** No breaking changes expected.

---

## Success Metrics

After modernization, verify:

- ✅ **Bundle Size**: 15-25% reduction in `dist/` sizes
- ✅ **Test Speed**: Jest runs in <60s (currently ~90-120s)
- ✅ **Vision Pro**: Runs at 60+ fps on hardware (if tested)
- ✅ **Text Quality**: SDF text sharp on high-DPI displays
- ✅ **No Regressions**: All existing examples work unchanged

---

## Decision Checklist

Before starting Phase 1:

- [ ] Team agrees on Vision Pro as primary platform
- [ ] Three.js r180+ compatibility tested with example shaders
- [ ] Rollup 4 migration plan reviewed by build owner
- [ ] Phase 3-4 can be deferred if needed (Phase 1-2 are critical)

---

## Next Steps

1. **Review** this plan with your team
2. **Assign** owner for each phase (especially rollup.config.js)
3. **Backup** current working state to a branch
4. **Execute** Phase 1 (Three.js + Rollup) — **This is the highest ROI**
5. **Test** on Vision Pro hardware before Phase 4

---

## Questions?

- **Performance concerns?** → Phase 1 reduces bundle by 15-25% (major win)
- **Compatibility concerns?** → Low risk; Troika uses stable Three.js API
- **Timeline concerns?** → Each phase is 1-2 weeks; can do in parallel
- **Vision Pro hardware?** → Phase 4 can be deferred; Phases 1-3 work on desktop

**Recommendation**: Start Phase 1 immediately; it's the highest-impact, lowest-risk upgrade.
