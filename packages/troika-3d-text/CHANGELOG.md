# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.24.1](https://github.com/protectwise/troika/compare/v0.24.0...v0.24.1) (2020-05-04)


### Bug Fixes

* **troika-3d-text:** fix error parsing fonts with CFF glyph outlines; fixes [#40](https://github.com/protectwise/troika/issues/40) ([0114ea6](https://github.com/protectwise/troika/commit/0114ea6c596c9fee19e75872e9462128863a2046))






# [0.24.0](https://github.com/protectwise/troika/compare/v0.23.0...v0.24.0) (2020-04-27)


### Bug Fixes

* **troika-3d-text:** change GlyphSegmentsQuadtree to not use  `class` ([7e4db6c](https://github.com/protectwise/troika/commit/7e4db6c56f81f48de80ba9e6cc48affae067678e))


### Features

* **troika-3d-text:** add `preloadFont` utility ([acedd3c](https://github.com/protectwise/troika/commit/acedd3c0799ccdaa9e583479b88441587f4b2db5)), closes [#39](https://github.com/protectwise/troika/issues/39)
* **troika-3d-text:** add enhanced `anchorX` and `anchorY` config properties ([b58f7b9](https://github.com/protectwise/troika/commit/b58f7b933853bac6a5c6d53d1fa3668886573161)), closes [#38](https://github.com/protectwise/troika/issues/38)
* **troika-3d-text:** add some useful font metrics to textRenderInfo result ([c7b14b8](https://github.com/protectwise/troika/commit/c7b14b8ab77e7b4ecbd080e4b94d5f257dd86c1a))


### Performance Improvements

* **troika-3d-text:** major speed/memory improvement in text layout ([1b65b33](https://github.com/protectwise/troika/commit/1b65b3355c05086bec2726771dabf9b21ed2e4a2))
* **troika-3d-text:** micro optimizations in text layout ([c786397](https://github.com/protectwise/troika/commit/c7863971609d9ffd9f9fc6a13a3f594262112b5c))
* **troika-3d-text:** optimize rendering of very long clipped text blocks ([c66fbec](https://github.com/protectwise/troika/commit/c66fbec228e45715c0b62586775b2f71c280ddc0))





# [0.23.0](https://github.com/protectwise/troika/compare/v0.22.0...v0.23.0) (2020-04-16)


### Bug Fixes

* **troika-3d-text:** selection range rects now honor clipRect, and are instanced ([ba86004](https://github.com/protectwise/troika/commit/ba860049c46d104fb755a192de56e8e397bb4862))


### Features

* **troika-worker-modules:** improve rehydration of functions in worker ([8f63090](https://github.com/protectwise/troika/commit/8f63090a5ad4fa3569faeade8e5c532ebfb065c5)), closes [#31](https://github.com/protectwise/troika/issues/31)





# [0.22.0](https://github.com/protectwise/troika/compare/v0.21.0...v0.22.0) (2020-04-02)


### Bug Fixes

* **troika-3d-text:** letterSpacing no longer applied after newlines ([61cb4f8](https://github.com/protectwise/troika/commit/61cb4f8b9a56cf14fb6ccc07c73449c721adbf4e)), closes [#33](https://github.com/protectwise/troika/issues/33)


### Features

* **troika-3d-text:** add 'orientation' parameter for defining default layout plane ([f2c0c76](https://github.com/protectwise/troika/commit/f2c0c763d4b92be84b26f878597cfa85724f7cc3)), closes [#34](https://github.com/protectwise/troika/issues/34)


### Performance Improvements

* **troika-3d-text:** move clipping logic from fragment to vertex shader ([1accf78](https://github.com/protectwise/troika/commit/1accf781546bd41dd19dd177eefefd6d8f56bdbd))





# [0.21.0](https://github.com/protectwise/troika/compare/v0.20.0...v0.21.0) (2020-03-27)


### Features

* **troika-three-utils:** derived shadow material uniforms are now synced automatically ([7843f23](https://github.com/protectwise/troika/commit/7843f2314caf9463262a16b15de948931b4b6511))





# [0.20.0](https://github.com/protectwise/troika/compare/v0.19.0...v0.20.0) (2020-03-16)

**Note:** Version bump only for package troika-3d-text





# [0.19.0](https://github.com/protectwise/troika/compare/v0.19.0-alpha.0...v0.19.0) (2020-02-28)

**Note:** Version bump only for package troika-3d-text





# [0.19.0-alpha.0](https://github.com/protectwise/troika/compare/v0.18.0...v0.19.0-alpha.0) (2020-02-22)

**Note:** Version bump only for package troika-3d-text





# [0.18.0](https://github.com/protectwise/troika/compare/v0.17.1...v0.18.0) (2020-02-21)

**Note:** Version bump only for package troika-3d-text
