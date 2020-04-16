# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.23.0](https://github.com/protectwise/troika/compare/v0.22.0...v0.23.0) (2020-04-16)


### Bug Fixes

* **troika-3d-text:** selection range rects now honor clipRect, and are instanced ([ba86004](https://github.com/protectwise/troika/commit/ba860049c46d104fb755a192de56e8e397bb4862))
* **troika-3d-ui:** allow canceling drag-scroll behavior with e.preventDefault() ([eca5f15](https://github.com/protectwise/troika/commit/eca5f15bb83c43d695e1674a6b265f208fb9a3cf))
* **troika-3d-ui:** prevent sync of text nodes before flex layout finishes ([4769cac](https://github.com/protectwise/troika/commit/4769cac2db7be7a925f1de5160e56ac95e4e97da))
* **troika-three-utils:** fragmentColorTransform is now inserted prior to postprocessing chunks ([97cd9ac](https://github.com/protectwise/troika/commit/97cd9ac3276c353597a374f1c7d2c7f23993aa7f)), closes [#20](https://github.com/protectwise/troika/issues/20)


### Features

* **troika-3d-ui:** add onAfterFlexLayoutApplied hook for `FlexNode`s ([912f95c](https://github.com/protectwise/troika/commit/912f95c9a0817b51cbfaef5872f3c5321c65d1fb))
* **troika-3d-ui:** allow overriding DatSelect dropdown styles/config ([bf78e79](https://github.com/protectwise/troika/commit/bf78e79951d836e159534c7c545c8a2e7126b996))
* **troika-worker-modules:** improve rehydration of functions in worker ([8f63090](https://github.com/protectwise/troika/commit/8f63090a5ad4fa3569faeade8e5c532ebfb065c5)), closes [#31](https://github.com/protectwise/troika/issues/31)


### Performance Improvements

* **troika-3d-ui:** make bg/border layers instanced, and move clipping to vertex shader ([f7526f4](https://github.com/protectwise/troika/commit/f7526f42f5ad02397aca656eadac80fa0ac13c90))





# [0.22.0](https://github.com/protectwise/troika/compare/v0.21.0...v0.22.0) (2020-04-02)


### Bug Fixes

* **examples:** fix transparency of globe ([8886bc1](https://github.com/protectwise/troika/commit/8886bc1540920a8fff39e97f8824d818a55bb8b5))
* **examples:** make bezier material doublesided ([163b3e0](https://github.com/protectwise/troika/commit/163b3e0de1ffcc4dc3f0020f1eb9b54ba9d95ece))
* **troika-3d-text:** letterSpacing no longer applied after newlines ([61cb4f8](https://github.com/protectwise/troika/commit/61cb4f8b9a56cf14fb6ccc07c73449c721adbf4e)), closes [#33](https://github.com/protectwise/troika/issues/33)
* **troika-xr:** fix TargetRay transparency by rendering last w/o depth testing ([045ec27](https://github.com/protectwise/troika/commit/045ec27abe9c8946f245ee22e4502ccdf133c4ef))


### Features

* **troika-3d-text:** add 'orientation' parameter for defining default layout plane ([f2c0c76](https://github.com/protectwise/troika/commit/f2c0c763d4b92be84b26f878597cfa85724f7cc3)), closes [#34](https://github.com/protectwise/troika/issues/34)


### Performance Improvements

* **troika-3d-text:** move clipping logic from fragment to vertex shader ([1accf78](https://github.com/protectwise/troika/commit/1accf781546bd41dd19dd177eefefd6d8f56bdbd))
* **troika-xr:** avoid full update pass every frame in WristMountedUI ([4a4cd16](https://github.com/protectwise/troika/commit/4a4cd16680d2c63a05e94dac8820d2a1cd3a0eab))
* **troika-xr:** avoid setting grip material colors every frame ([d3f1246](https://github.com/protectwise/troika/commit/d3f12463b70a46c9a883289f022fa9a6b95f3ccc))





# [0.21.0](https://github.com/protectwise/troika/compare/v0.20.0...v0.21.0) (2020-03-27)


### Features

* **examples:** beziers: add instanceable version of the beziers, and add point light option ([0739f4d](https://github.com/protectwise/troika/commit/0739f4d6ebcdd13be46b6371c95504b290c86359))
* **troika-3d:** instancing now supports custom derived materials ([bad5e02](https://github.com/protectwise/troika/commit/bad5e022e29e0b656258017f8697d1611eb9d2e9))
* **troika-3d:** reduce instancing batch size to 128 ([dc4bd8a](https://github.com/protectwise/troika/commit/dc4bd8aadd5826b4fe8247f981a03f43624a7bd7))
* **troika-3d:** update ThreeJS support up to r115 ([531ff6a](https://github.com/protectwise/troika/commit/531ff6a175b41d6fd273b1ca0fa91c5826360b22))
* **troika-three-utils:** added new options for createDerivedMaterial ([d67bb4a](https://github.com/protectwise/troika/commit/d67bb4a569e151efad87a047e845607226f02027))
* **troika-three-utils:** derived shadow material uniforms are now synced automatically ([7843f23](https://github.com/protectwise/troika/commit/7843f2314caf9463262a16b15de948931b4b6511))





# [0.20.0](https://github.com/protectwise/troika/compare/v0.19.0...v0.20.0) (2020-03-16)


### Bug Fixes

* **troika-3d-ui:** fix scrollbars sometimes appearing inappropriately ([010be47](https://github.com/protectwise/troika/commit/010be47962f1f275d99c751bcf50f3e111667299))
* **troika-3d-ui:** update children when first exiting clip rect ([294f341](https://github.com/protectwise/troika/commit/294f34121e1d20a2152fea354767150abc4e3b1d))


### Features

* **troika-3d-ui:** allow dat-gui items to declare their own onUpdate ([a707fd5](https://github.com/protectwise/troika/commit/a707fd5988c4f664a5cfe3ee72747d13b65535e3))
* **troika-3d-ui:** enable shadow casting by UI block bg/border layers ([d2c056c](https://github.com/protectwise/troika/commit/d2c056cb2d599021f61d6de4ff7223f6b7ca52e6))
* **troika-worker-utils:** export function for stringifying functions ([977634b](https://github.com/protectwise/troika/commit/977634b5eecb41e4e7aa61addf5b7bfd721ab9e2))


### Performance Improvements

* skip updating children of inactive wrist-mounted ui ([c1b93f1](https://github.com/protectwise/troika/commit/c1b93f18228e1c051a3941d15f6bd31a3a682e2d))





# [0.19.0](https://github.com/protectwise/troika/compare/v0.19.0-alpha.0...v0.19.0) (2020-02-28)


### Bug Fixes

* **troika-xr:** disable buggy experimental clickOnPoke feature ([46cff53](https://github.com/protectwise/troika/commit/46cff535f24e661e727714e12e05326c830d1a90))


### Features

* **examples:** example configurators are standardized and work in XR ([cec6f63](https://github.com/protectwise/troika/commit/cec6f63a2c45ad4a4b38e1826cec852d756e016d))
* **troika-xr:** improved default target ray appearance ([3798d9e](https://github.com/protectwise/troika/commit/3798d9e9451763c12d0273bb7d6f027c4ae79621))





# [0.19.0-alpha.0](https://github.com/protectwise/troika/compare/v0.18.0...v0.19.0-alpha.0) (2020-02-22)


### Bug Fixes

* honor MeshFacade.autoDispose* when geometry or material changes ([f478a47](https://github.com/protectwise/troika/commit/f478a47da138007a73804cf6af9b81f8d2234770))


### Features

* add a CircleFacade primitive ([d73ae87](https://github.com/protectwise/troika/commit/d73ae872c8838181801b226adc7c02f3fcbb14bf))
* **troika-3d-ui:** add DatGuiFacade and supporting widgets ([c463198](https://github.com/protectwise/troika/commit/c463198c9b06eaa42c281318e82ff79fbbf31193))
* **troika-xr:** add WristMountedUI component ([74f5b10](https://github.com/protectwise/troika/commit/74f5b108931c7bcee0c55de1e2fa3a4c26559a5b))





# [0.18.0](https://github.com/protectwise/troika/compare/v0.17.1...v0.18.0) (2020-02-21)


### Bug Fixes

* the PlaneFacade's geometry now faces up ([cb1bb1b](https://github.com/protectwise/troika/commit/cb1bb1b4b26f2f09fab4e433e2449ca2f3d2aa1a))


### Features

* Add a set of facades for common primitive meshes, using shared geometries and with setters for builtin material properties. ([d4b309b](https://github.com/protectwise/troika/commit/d4b309b179edba4b59ca87d13100a38be1b374a7))
* Add memoize function in utils ([16efb01](https://github.com/protectwise/troika/commit/16efb013eb62bb3630b0375ad7a054820aa2382c))
* **troika-3d:** allow passing a Vector3 instance to getCameraPosition ([f686483](https://github.com/protectwise/troika/commit/f6864835649b00cef4b53d3a9bd5d3d880d57d8d))
