# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.39.1](https://github.com/protectwise/troika/compare/v0.39.0...v0.39.1) (2021-02-17)


### Bug Fixes

* **troika-three-text:** selection rects no longer clip off trailing whitespace ([158305c](https://github.com/protectwise/troika/commit/158305c9f3f83aa3729b2d32c1ae2d9112540348)), closes [#78](https://github.com/protectwise/troika/issues/78)





# [0.39.0](https://github.com/protectwise/troika/compare/v0.38.1...v0.39.0) (2021-02-15)


### Features

* **troika-three-text:** add curveRadius for applying cylindrical curvature ([6fdfbbf](https://github.com/protectwise/troika/commit/6fdfbbfcc0cdae0143555c9cb6569ba9e70150c5))
* **troika-three-text:** export a function for debugging SDF textures ([3fb0c23](https://github.com/protectwise/troika/commit/3fb0c23bae22b3812839c0639f8278d68120fc8c))
* **troika-three-text:** pack SDFs using all 4 color channels, to increase max glyphs in a texture ([d236caf](https://github.com/protectwise/troika/commit/d236caf9526b5b05bb14980f54f3d73a207ed874))





## [0.38.1](https://github.com/protectwise/troika/compare/v0.38.0...v0.38.1) (2021-02-03)


### Bug Fixes

* **troika-three-text:** prevent copy() from sharing geometry between instances ([8c3ba2d](https://github.com/protectwise/troika/commit/8c3ba2d8f610c045dadee17a6221ea61ab8d26d4))





# [0.38.0](https://github.com/protectwise/troika/compare/v0.37.0...v0.38.0) (2021-01-24)


### Bug Fixes

* **troika-three-text:** allow negative percentages for outlineOffsetX/Y ([3a274f0](https://github.com/protectwise/troika/commit/3a274f070b30e5312e2f546f66db2ab9352962ca)), closes [#100](https://github.com/protectwise/troika/issues/100)





# [0.37.0](https://github.com/protectwise/troika/compare/v0.36.1...v0.37.0) (2021-01-18)


### Features

* **troika-three-text:** added inner stroke and outline blur capabilities ([e004b9d](https://github.com/protectwise/troika/commit/e004b9d2f7e2ef9e841e61156b68958076533a62))


### Performance Improvements

* **troika-three-text:** swap tiny-inflate to fflate for minor speed boost on woff fonts ([2ae29fa](https://github.com/protectwise/troika/commit/2ae29faffcec2302453ce9dabac633ade8181127))






## [0.36.1](https://github.com/protectwise/troika/compare/v0.36.0...v0.36.1) (2020-12-16)


### Bug Fixes

* **troika-three-text:** soften Typr.ts console warnings to debug level ([50d951f](https://github.com/protectwise/troika/commit/50d951fd06108194ef0a485af1fcce58c2710cde))





# [0.36.0](https://github.com/protectwise/troika/compare/v0.35.0...v0.36.0) (2020-12-04)


### Bug Fixes

* **troika-three-text:** fix wrong caret position for collapsed ligature characters ([f220035](https://github.com/protectwise/troika/commit/f220035430787b3d178ad8cfe4b067fe9793de97))


### Features

* **troika-three-text:** fix kerning by updating from Typr.js to Typr.ts ([43144cf](https://github.com/protectwise/troika/commit/43144cfbb8f553d552a5bef179a7e5cfc8179fe3)), closes [#70](https://github.com/protectwise/troika/issues/70)





# [0.35.0](https://github.com/protectwise/troika/compare/v0.34.2...v0.35.0) (2020-11-16)

**Note:** Version bump only for package troika-three-text





## [0.34.2](https://github.com/protectwise/troika/compare/v0.34.1...v0.34.2) (2020-11-09)


### Bug Fixes

* **troika-three-text:** dispose the outline material when the base material is disposed ([68bd2c8](https://github.com/protectwise/troika/commit/68bd2c867f9ccbb53a41b2a3c3aedcf886354d38))
* **troika-three-text:** fix error when disposing the base material with outlines enabled ([73a51f5](https://github.com/protectwise/troika/commit/73a51f5ef87676727667becc0e6bbc6495bff751))






## [0.34.1](https://github.com/protectwise/troika/compare/v0.34.0...v0.34.1) (2020-10-20)

**Note:** Version bump only for package troika-three-text





# [0.34.0](https://github.com/protectwise/troika/compare/v0.33.1...v0.34.0) (2020-10-19)


### Bug Fixes

* **troika-three-text:** clipRect is no longer clamped to the text block's bounds ([15edbd9](https://github.com/protectwise/troika/commit/15edbd95c0ec525c4a268ff3781e6e516981da02))
* **troika-three-text:** fix text baseline being positioned too low ([596d8ca](https://github.com/protectwise/troika/commit/596d8ca1e6ba35f9e68bcbda74329823a3b1b1ad))


### Features

* **troika-three-text:** expose blockBounds and visibleBounds in textRenderInfo ([f3340ec](https://github.com/protectwise/troika/commit/f3340ec1efac6a6b00f596d9ef898ed7c2a6568a))
* **troika-three-text:** text outline and better antialiasing at small sizes ([3836809](https://github.com/protectwise/troika/commit/3836809cc919b57b5eb357e66e35a15903bd54f7))


### Performance Improvements

* micro-optimization of sdf texture insertion loop ([995c2a6](https://github.com/protectwise/troika/commit/995c2a6652181f26677b8da4207f18c32455e59c))






## [0.33.1](https://github.com/protectwise/troika/compare/v0.33.0...v0.33.1) (2020-10-02)

**Note:** Version bump only for package troika-three-text





# [0.33.0](https://github.com/protectwise/troika/compare/v0.32.0...v0.33.0) (2020-10-02)


### Bug Fixes

* add "sideEffects":false to package.json files to assist treeshaking ([61109b2](https://github.com/protectwise/troika/commit/61109b2e3d21dc794ef66b3f28cf63bbdd34150e))
* add PURE annotations to make troika-three-text treeshakeable ([8e76b5c](https://github.com/protectwise/troika/commit/8e76b5c31a3cbda86595654ba9d66d8d635e44a1))
* remove redundant "browser" and defunct "jsnext:main" fields from package.json files ([0abec40](https://github.com/protectwise/troika/commit/0abec40e3af06d3ae4d990bf198d871b46730f1f))
* **troika-three-text:** make `color` prop only apply to that instance when sharing a base material ([da0f995](https://github.com/protectwise/troika/commit/da0f995be3b7594bafc6f24dd6981ee787ff4ee1))


### Features

* **troika-three-text:** modifications to the base material are now picked up automatically ([fc81d3a](https://github.com/protectwise/troika/commit/fc81d3a13ef84a8358bfbdcac066cb13a161c7f6))





# [0.32.0](https://github.com/protectwise/troika/compare/v0.31.0...v0.32.0) (2020-09-16)


### Bug Fixes

* mutate boundingBox and set depth to 0 ([1f9b6be](https://github.com/protectwise/troika/commit/1f9b6bef083c26c9de9ac0ce169544ed3f99cf89))


### Features

* added boundingBox calculation ([140e9e8](https://github.com/protectwise/troika/commit/140e9e8bf2865c54f21877ca03834bbde4e9ab52))





# [0.31.0](https://github.com/protectwise/troika/compare/v0.30.2...v0.31.0) (2020-08-11)

**Note:** Version bump only for package troika-three-text





## [0.30.2](https://github.com/protectwise/troika/compare/v0.30.1...v0.30.2) (2020-07-22)


### Bug Fixes

* **troika-three-text:** prevent unbound buffer errors when disposing a GlyphsGeometry ([e860eac](https://github.com/protectwise/troika/commit/e860eacd04404a328cc758af9103f5d2f55201ba)), closes [#69](https://github.com/protectwise/troika/issues/69) [react-spring/drei#62](https://github.com/react-spring/drei/issues/62)





## [0.30.1](https://github.com/protectwise/troika/compare/v0.30.0...v0.30.1) (2020-07-19)


### Bug Fixes

* **troika-three-text:** fix changing text length in ThreeJS r117+ ([a7ef945](https://github.com/protectwise/troika/commit/a7ef945119649b4c3b451783000dd5c40ad3f3ba)), closes [#69](https://github.com/protectwise/troika/issues/69)





# [0.30.0](https://github.com/protectwise/troika/compare/v0.29.0...v0.30.0) (2020-07-16)


### Features

* **troika-three-text:** add support for textIndent ([b689c0c](https://github.com/protectwise/troika/commit/b689c0c1b1d9de437eeea9390cfcf9be6c10eae9))





# [0.29.0](https://github.com/protectwise/troika/compare/v0.28.1...v0.29.0) (2020-07-06)


### Features

* **troika-three-text:** promote standalone text to a new `troika-three-text` package ([995f2eb](https://github.com/protectwise/troika/commit/995f2eb7202789a83671878209c65d240082ade7)), closes [#47](https://github.com/protectwise/troika/issues/47)
