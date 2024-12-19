# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.52.3](https://github.com/protectwise/troika/compare/v0.52.2...v0.52.3) (2024-12-19)

**Note:** Version bump only for package troika-examples





## [0.52.2](https://github.com/protectwise/troika/compare/v0.52.1...v0.52.2) (2024-11-21)

**Note:** Version bump only for package troika-examples





## [0.52.1](https://github.com/protectwise/troika/compare/v0.52.0...v0.52.1) (2024-11-21)

**Note:** Version bump only for package troika-examples





# [0.52.0](https://github.com/protectwise/troika/compare/v0.51.1...v0.52.0) (2024-11-11)


### Features

* **BatchedText:** Support remaining visual properties ([60c5e93](https://github.com/protectwise/troika/commit/60c5e93ae5068f153240c5cfa1a109c01e4a4f51))





## [0.51.1](https://github.com/protectwise/troika/compare/v0.51.0...v0.51.1) (2024-11-11)

**Note:** Version bump only for package troika-examples





# [0.51.0](https://github.com/protectwise/troika/compare/v0.50.3...v0.51.0) (2024-11-10)


### Features

* **BatchedText:** support fillOpacity, and color now sets the `diffuse` uniform ([8f83424](https://github.com/protectwise/troika/commit/8f8342447f3fe4a31420cf46fdb191ddc0afb929))





## [0.50.3](https://github.com/protectwise/troika/compare/v0.50.2...v0.50.3) (2024-11-01)

**Note:** Version bump only for package troika-examples





## [0.50.2](https://github.com/protectwise/troika/compare/v0.50.1...v0.50.2) (2024-10-21)

**Note:** Version bump only for package troika-examples





## [0.50.1](https://github.com/protectwise/troika/compare/v0.50.0...v0.50.1) (2024-10-12)


### Bug Fixes

* **troika-three-text:** remove DoubleSide double draw hack in favor of forceSinglePass flag ([7818d05](https://github.com/protectwise/troika/commit/7818d05745f5ca44530aae774df13deafb35588a))





# [0.50.0](https://github.com/protectwise/troika/compare/v0.49.1...v0.50.0) (2024-10-11)


### Features

* **troika-three-text:** ALPHA: BatchedText for batching many Text instances in a single draw call ([79c9c50](https://github.com/protectwise/troika/commit/79c9c50d0f8fec1e1d64e316d47fbb71fd164857))





## [0.49.1](https://github.com/protectwise/troika/compare/v0.49.0...v0.49.1) (2024-04-09)

**Note:** Version bump only for package troika-examples





# [0.49.0](https://github.com/protectwise/troika/compare/v0.48.1...v0.49.0) (2023-10-08)


### Features

* add support for positioning of diacritic marks (e.g. Thai) ([301c34c](https://github.com/protectwise/troika/commit/301c34c3341b83eb95afc308bd796bcccb2f5ccd))





## [0.48.1](https://github.com/protectwise/troika/compare/v0.48.0...v0.48.1) (2023-10-02)

**Note:** Version bump only for package troika-examples





# [0.48.0](https://github.com/protectwise/troika/compare/v0.47.2...v0.48.0) (2023-09-09)


### Features

* **troika-three-text:** add fallback font loading for full Unicode support ([#279](https://github.com/protectwise/troika/issues/279)) ([6fb8061](https://github.com/protectwise/troika/commit/6fb806145f79d7a36e79a35a006b4601535b3827)), closes [#13](https://github.com/protectwise/troika/issues/13) [#65](https://github.com/protectwise/troika/issues/65)








## [0.47.2](https://github.com/protectwise/troika/compare/v0.47.1...v0.47.2) (2023-05-15)

**Note:** Version bump only for package troika-examples





## [0.47.1](https://github.com/protectwise/troika/compare/v0.47.0...v0.47.1) (2022-12-15)

**Note:** Version bump only for package troika-examples





# [0.47.0](https://github.com/protectwise/troika/compare/v0.46.3...v0.47.0) (2022-12-15)


### Bug Fixes

* add compatibility up to ThreeJS r127 ([03640a0](https://github.com/protectwise/troika/commit/03640a093e1b56049229420ff421317528bb583d))


### Features

* raise three min version to r125 and fix BufferGeometry references ([#225](https://github.com/protectwise/troika/issues/225)) ([f2ef803](https://github.com/protectwise/troika/commit/f2ef803db7ab3d9d03de2719a2781c1c3f5122cf))
* **troika-three-text:** add 'top-cap' and 'top-ex' as keywords for anchorY ([#193](https://github.com/protectwise/troika/issues/193)) ([c6a10ae](https://github.com/protectwise/troika/commit/c6a10ae30837d26505d5614b8e15ab49f2ad4625))





## [0.46.3](https://github.com/protectwise/troika/compare/v0.46.2...v0.46.3) (2022-03-11)

**Note:** Version bump only for package troika-examples





## [0.46.2](https://github.com/protectwise/troika/compare/v0.46.1...v0.46.2) (2022-03-06)

**Note:** Version bump only for package troika-examples





## [0.46.1](https://github.com/protectwise/troika/compare/v0.46.0...v0.46.1) (2022-03-05)

**Note:** Version bump only for package troika-examples





# [0.46.0](https://github.com/protectwise/troika/compare/v0.45.0...v0.46.0) (2022-03-05)


### Features

* **troika-three-text:** add a `gpuAccelerateSDF` property for opting out of webgl sdf generation ([d436ffd](https://github.com/protectwise/troika/commit/d436ffd5063747e2e4d453240b702b174f91268d))
* **troika-three-text:** integrate webgl-sdf-generator for GPU-accelerated SDF generation ([b5c9138](https://github.com/protectwise/troika/commit/b5c913882daf480d18def77927e0dc70add082df))





# [0.45.0](https://github.com/protectwise/troika/compare/v0.44.0...v0.45.0) (2022-01-02)

**Note:** Version bump only for package troika-examples





# [0.44.0](https://github.com/protectwise/troika/compare/v0.43.1-alpha.0...v0.44.0) (2021-11-14)

**Note:** Version bump only for package troika-examples





## [0.43.1-alpha.0](https://github.com/protectwise/troika/compare/v0.43.0...v0.43.1-alpha.0) (2021-10-24)

**Note:** Version bump only for package troika-examples





# [0.43.0](https://github.com/protectwise/troika/compare/v0.42.0...v0.43.0) (2021-09-20)


### Features

* don't transpile UMD build files, fixing usage with Three.js r128 ([e380b0d](https://github.com/protectwise/troika/commit/e380b0d582c1edd2a024a8d3201ecf498579d2b7)), closes [#130](https://github.com/protectwise/troika/issues/130)






# [0.42.0](https://github.com/protectwise/troika/compare/v0.41.2...v0.42.0) (2021-05-17)


### Bug Fixes

* add three to peerDependencies in all leaf packages ([0a11ab6](https://github.com/protectwise/troika/commit/0a11ab6ddff13b3ebd0f1f2463e0cfed17b3f5fa))





## [0.41.2](https://github.com/protectwise/troika/compare/v0.41.1...v0.41.2) (2021-05-05)

**Note:** Version bump only for package troika-examples





## [0.41.1](https://github.com/protectwise/troika/compare/v0.41.0...v0.41.1) (2021-04-26)

**Note:** Version bump only for package troika-examples





# [0.41.0](https://github.com/protectwise/troika/compare/v0.40.0...v0.41.0) (2021-04-19)


### Features

* update support up to threejs r127 ([5b512f0](https://github.com/protectwise/troika/commit/5b512f04843f15bdaadd7297d6ab1d964c67333b))
* **troika-three-text:** add full bidi text support ([3fde850](https://github.com/protectwise/troika/commit/3fde850d28524393538e2bac8920f7a4ee0e1fb4))
* **troika-three-text:** simple bidi layout support, using explicit LRO/RLO/PDF chars only ([d511655](https://github.com/protectwise/troika/commit/d511655926f53262abb4b6c990c5102180f23f64))





# [0.40.0](https://github.com/protectwise/troika/compare/v0.39.2...v0.40.0) (2021-02-28)


### Bug Fixes

* **troika-three-text:** fix boundingBox, boundingSphere, and raycasting with curveRadius ([7cc7c82](https://github.com/protectwise/troika/commit/7cc7c821eca8f7ae63170d9a484e806bc8814a94)), closes [#103](https://github.com/protectwise/troika/issues/103)


### Features

* **troika-3d:** add `initThreeObject` lifecycle method to Object3DFacade ([230a87d](https://github.com/protectwise/troika/commit/230a87df38c392ac54732561d67fb4eb46634dd8))
* **troika-3d:** remove need for manually defining material.instanceUniforms ([a234f8c](https://github.com/protectwise/troika/commit/a234f8c354b5fb5f54d13c58355887f02b7f32d8))





## [0.39.2](https://github.com/protectwise/troika/compare/v0.39.1...v0.39.2) (2021-02-18)

**Note:** Version bump only for package troika-examples





## [0.39.1](https://github.com/protectwise/troika/compare/v0.39.0...v0.39.1) (2021-02-17)

**Note:** Version bump only for package troika-examples





# [0.39.0](https://github.com/protectwise/troika/compare/v0.38.1...v0.39.0) (2021-02-15)


### Features

* **troika-three-text:** export a function for debugging SDF textures ([3fb0c23](https://github.com/protectwise/troika/commit/3fb0c23bae22b3812839c0639f8278d68120fc8c))





## [0.38.1](https://github.com/protectwise/troika/compare/v0.38.0...v0.38.1) (2021-02-03)


### Bug Fixes

* update to support up to Three r125 ([4edff04](https://github.com/protectwise/troika/commit/4edff042d13dec49377d18baf4f958de285a3f2a))





# [0.38.0](https://github.com/protectwise/troika/compare/v0.37.0...v0.38.0) (2021-01-24)

**Note:** Version bump only for package troika-examples





# [0.37.0](https://github.com/protectwise/troika/compare/v0.36.1...v0.37.0) (2021-01-18)


### Features

* **troika-three-text:** added inner stroke and outline blur capabilities ([e004b9d](https://github.com/protectwise/troika/commit/e004b9d2f7e2ef9e841e61156b68958076533a62))






## [0.36.1](https://github.com/protectwise/troika/compare/v0.36.0...v0.36.1) (2020-12-16)

**Note:** Version bump only for package troika-examples





# [0.36.0](https://github.com/protectwise/troika/compare/v0.35.0...v0.36.0) (2020-12-04)


### Features

* **troika-three-text:** fix kerning by updating from Typr.js to Typr.ts ([43144cf](https://github.com/protectwise/troika/commit/43144cfbb8f553d552a5bef179a7e5cfc8179fe3)), closes [#70](https://github.com/protectwise/troika/issues/70)





# [0.35.0](https://github.com/protectwise/troika/compare/v0.34.2...v0.35.0) (2020-11-16)


### Features

* initial support for spring physics-based transitions ([5e05bc8](https://github.com/protectwise/troika/commit/5e05bc8b0f2d0dd7af1f5f59f41c60929ac45ae2))





## [0.34.2](https://github.com/protectwise/troika/compare/v0.34.1...v0.34.2) (2020-11-09)

**Note:** Version bump only for package troika-examples






## [0.34.1](https://github.com/protectwise/troika/compare/v0.34.0...v0.34.1) (2020-10-20)

**Note:** Version bump only for package troika-examples





# [0.34.0](https://github.com/protectwise/troika/compare/v0.33.1...v0.34.0) (2020-10-19)


### Features

* **troika-three-text:** text outline and better antialiasing at small sizes ([3836809](https://github.com/protectwise/troika/commit/3836809cc919b57b5eb357e66e35a15903bd54f7))






## [0.33.1](https://github.com/protectwise/troika/compare/v0.33.0...v0.33.1) (2020-10-02)

**Note:** Version bump only for package troika-examples





# [0.33.0](https://github.com/protectwise/troika/compare/v0.32.0...v0.33.0) (2020-10-02)


### Features

* **troika-three-utils:** add `chained` option to createDerivedMaterial ([2bfaa9c](https://github.com/protectwise/troika/commit/2bfaa9cd5a9ab9b936388e3c4f11e5d44e175eb7))





# [0.32.0](https://github.com/protectwise/troika/compare/v0.31.0...v0.32.0) (2020-09-16)

**Note:** Version bump only for package troika-examples





# [0.31.0](https://github.com/protectwise/troika/compare/v0.30.2...v0.31.0) (2020-08-11)

**Note:** Version bump only for package troika-examples





## [0.30.2](https://github.com/protectwise/troika/compare/v0.30.1...v0.30.2) (2020-07-22)

**Note:** Version bump only for package troika-examples





## [0.30.1](https://github.com/protectwise/troika/compare/v0.30.0...v0.30.1) (2020-07-19)

**Note:** Version bump only for package troika-examples





# [0.30.0](https://github.com/protectwise/troika/compare/v0.29.0...v0.30.0) (2020-07-16)


### Features

* **troika-three-text:** add support for textIndent ([b689c0c](https://github.com/protectwise/troika/commit/b689c0c1b1d9de437eeea9390cfcf9be6c10eae9))





# [0.29.0](https://github.com/protectwise/troika/compare/v0.28.1...v0.29.0) (2020-07-06)


### Features

* **troika-3d-text:** add sdfGlyphSize option on TextMesh ([978ef53](https://github.com/protectwise/troika/commit/978ef534442ec159353c8aa4c0ebe45ac21b4189)), closes [#58](https://github.com/protectwise/troika/issues/58)





## [0.28.1](https://github.com/protectwise/troika/compare/v0.28.0...v0.28.1) (2020-06-17)

**Note:** Version bump only for package troika-examples





# [0.28.0](https://github.com/protectwise/troika/compare/v0.27.1...v0.28.0) (2020-06-09)

**Note:** Version bump only for package troika-examples





## [0.27.1](https://github.com/protectwise/troika/compare/v0.27.0...v0.27.1) (2020-06-05)

**Note:** Version bump only for package troika-examples





# [0.27.0](https://github.com/protectwise/troika/compare/v0.26.1...v0.27.0) (2020-06-02)


### Features

* **troika-3d:** add three.js r117 to supported version range ([2761f39](https://github.com/protectwise/troika/commit/2761f39c272ecacd1dc0ce4f4cab8f166d373e90))
* **troika-examples:** flexbox example: globe pokes through bg, add scrollable lists ([074c620](https://github.com/protectwise/troika/commit/074c62066924ceb55317b9d51a755d63044758ad))





## [0.26.1](https://github.com/protectwise/troika/compare/v0.26.0...v0.26.1) (2020-05-26)

**Note:** Version bump only for package troika-examples





# [0.26.0](https://github.com/protectwise/troika/compare/v0.25.0...v0.26.0) (2020-05-24)


### Features

* **examples:** add example showing a resizable flexbox layout ([8f4d50d](https://github.com/protectwise/troika/commit/8f4d50d9e4dfbbdd83ce528bc636738ea1677262))
* **troika-3d-text:** experimental `colorRanges` feature ([c4971c3](https://github.com/protectwise/troika/commit/c4971c3b10dff597fb071b2039a6874df99c70a9))





# [0.25.0](https://github.com/protectwise/troika/compare/v0.24.1...v0.25.0) (2020-05-19)

**Note:** Version bump only for package troika-examples





## [0.24.1](https://github.com/protectwise/troika/compare/v0.24.0...v0.24.1) (2020-05-04)

**Note:** Version bump only for package troika-examples






# [0.24.0](https://github.com/protectwise/troika/compare/v0.23.0...v0.24.0) (2020-04-27)


### Features

* **troika-3d-text:** add enhanced `anchorX` and `anchorY` config properties ([b58f7b9](https://github.com/protectwise/troika/commit/b58f7b933853bac6a5c6d53d1fa3668886573161)), closes [#38](https://github.com/protectwise/troika/issues/38)





# [0.23.0](https://github.com/protectwise/troika/compare/v0.22.0...v0.23.0) (2020-04-16)

**Note:** Version bump only for package troika-examples





# [0.22.0](https://github.com/protectwise/troika/compare/v0.21.0...v0.22.0) (2020-04-02)


### Bug Fixes

* **examples:** fix transparency of globe ([8886bc1](https://github.com/protectwise/troika/commit/8886bc1540920a8fff39e97f8824d818a55bb8b5))
* **examples:** make bezier material doublesided ([163b3e0](https://github.com/protectwise/troika/commit/163b3e0de1ffcc4dc3f0020f1eb9b54ba9d95ece))





# [0.21.0](https://github.com/protectwise/troika/compare/v0.20.0...v0.21.0) (2020-03-27)


### Features

* **examples:** beziers: add instanceable version of the beziers, and add point light option ([0739f4d](https://github.com/protectwise/troika/commit/0739f4d6ebcdd13be46b6371c95504b290c86359))
* **troika-3d:** instancing now supports custom derived materials ([bad5e02](https://github.com/protectwise/troika/commit/bad5e022e29e0b656258017f8697d1611eb9d2e9))
* **troika-3d:** update ThreeJS support up to r115 ([531ff6a](https://github.com/protectwise/troika/commit/531ff6a175b41d6fd273b1ca0fa91c5826360b22))





# [0.20.0](https://github.com/protectwise/troika/compare/v0.19.0...v0.20.0) (2020-03-16)

**Note:** Version bump only for package troika-examples





# [0.19.0](https://github.com/protectwise/troika/compare/v0.19.0-alpha.0...v0.19.0) (2020-02-28)


### Features

* **examples:** example configurators are standardized and work in XR ([cec6f63](https://github.com/protectwise/troika/commit/cec6f63a2c45ad4a4b38e1826cec852d756e016d))





# [0.19.0-alpha.0](https://github.com/protectwise/troika/compare/v0.18.0...v0.19.0-alpha.0) (2020-02-22)


### Features

* **troika-3d-ui:** add DatGuiFacade and supporting widgets ([c463198](https://github.com/protectwise/troika/commit/c463198c9b06eaa42c281318e82ff79fbbf31193))





# [0.18.0](https://github.com/protectwise/troika/compare/v0.17.1...v0.18.0) (2020-02-21)

**Note:** Version bump only for package troika-examples
