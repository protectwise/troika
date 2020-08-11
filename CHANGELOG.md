# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.31.0](https://github.com/protectwise/troika/compare/v0.30.2...v0.31.0) (2020-08-11)


### Bug Fixes

* **troika-3d-ui:** remove stray circular import ([06be563](https://github.com/protectwise/troika/commit/06be56308e592f6d99df39128227f8e8b6f05bd4))
* move Three.js peerDependency from troika-3d to troika-three-utils ([96b6fc8](https://github.com/protectwise/troika/commit/96b6fc8c9d80ddce358b74d6bb80a063500476ac))


### Features

* **troika-3d:** expose some new props for scene background and color management ([5209f66](https://github.com/protectwise/troika/commit/5209f66f67f37036a659b0b660e5b343d682c64f))





## [0.30.2](https://github.com/protectwise/troika/compare/v0.30.1...v0.30.2) (2020-07-22)


### Bug Fixes

* **troika-three-text:** prevent unbound buffer errors when disposing a GlyphsGeometry ([e860eac](https://github.com/protectwise/troika/commit/e860eacd04404a328cc758af9103f5d2f55201ba)), closes [#69](https://github.com/protectwise/troika/issues/69) [react-spring/drei#62](https://github.com/react-spring/drei/issues/62)





## [0.30.1](https://github.com/protectwise/troika/compare/v0.30.0...v0.30.1) (2020-07-19)


### Bug Fixes

* **troika-3d-ui:** fix inheritable props on text nodes, and add textIndent ([0650c59](https://github.com/protectwise/troika/commit/0650c594319bea46df8c1308a1bfcb4b51d14faa))
* **troika-three-text:** fix changing text length in ThreeJS r117+ ([a7ef945](https://github.com/protectwise/troika/commit/a7ef945119649b4c3b451783000dd5c40ad3f3ba)), closes [#69](https://github.com/protectwise/troika/issues/69)





# [0.30.0](https://github.com/protectwise/troika/compare/v0.29.0...v0.30.0) (2020-07-16)


### Bug Fixes

* **troika-worker-utils:** decrease main thread message level from warn to log ([d7cee6d](https://github.com/protectwise/troika/commit/d7cee6d534c6a01f9c3bc984015f7f824f0b458f))


### Features

* **troika-three-text:** add support for textIndent ([b689c0c](https://github.com/protectwise/troika/commit/b689c0c1b1d9de437eeea9390cfcf9be6c10eae9))
* extract flexbox layout logic to a new `troika-flex-layout` package ([1b52fc9](https://github.com/protectwise/troika/commit/1b52fc9a9a5a3ae03c27d0d12a0f62c3d73fe599)), closes [#53](https://github.com/protectwise/troika/issues/53)





# [0.29.0](https://github.com/protectwise/troika/compare/v0.28.1...v0.29.0) (2020-07-06)


### Bug Fixes

* **troika-three-utils:** fix program switching when double-deriving materials ([89ed2f8](https://github.com/protectwise/troika/commit/89ed2f8eab6dfccba3aab95ea667642d13976bfc))
* **troika-xr:** ensure correct initial transform of gltf objects on load ([49287f3](https://github.com/protectwise/troika/commit/49287f328dd89b595e9a4305603bad661decb756))


### Features

* **troika-3d-text:** add sdfGlyphSize option on TextMesh ([978ef53](https://github.com/protectwise/troika/commit/978ef534442ec159353c8aa4c0ebe45ac21b4189)), closes [#58](https://github.com/protectwise/troika/issues/58)
* **troika-three-text:** promote standalone text to a new `troika-three-text` package ([995f2eb](https://github.com/protectwise/troika/commit/995f2eb7202789a83671878209c65d240082ade7)), closes [#47](https://github.com/protectwise/troika/issues/47)





## [0.28.1](https://github.com/protectwise/troika/compare/v0.28.0...v0.28.1) (2020-06-17)


### Bug Fixes

* **troika-3d-text:** don't dispose derived materials on base material switch ([3d88475](https://github.com/protectwise/troika/commit/3d88475d2f3ead6bec92694ff0720d4ab643e872)), closes [#59](https://github.com/protectwise/troika/issues/59)
* **troika-3d-text:** set correct `object` in TextMesh raycast intersections ([9f3eaa7](https://github.com/protectwise/troika/commit/9f3eaa713d759996aea274d33a0443541482453a)), closes [#62](https://github.com/protectwise/troika/issues/62)


### Performance Improvements

* **troika-three-utils:** increase chance of program reuse in createDerivedMaterial ([56daf65](https://github.com/protectwise/troika/commit/56daf6535a7bd8fec30d86a713feb5b8f26fa6a5)), closes [#59](https://github.com/protectwise/troika/issues/59)





# [0.28.0](https://github.com/protectwise/troika/compare/v0.27.1...v0.28.0) (2020-06-09)


### Bug Fixes

* **troika-3d-text:** fix cloning of TextMesh ([13df49b](https://github.com/protectwise/troika/commit/13df49b522abbd13a258b70f340779f940d3adfe)), closes [#60](https://github.com/protectwise/troika/issues/60)
* **troika-3d-text:** prevent double-derivation of text material ([ef8cffa](https://github.com/protectwise/troika/commit/ef8cffaa0eb1717ca73e8a04b8bfcf8f031d2e52)), closes [#59](https://github.com/protectwise/troika/issues/59)


### Features

* **troika-3d-text:** add glyphGeometryDetail parameter ([1f7a11f](https://github.com/protectwise/troika/commit/1f7a11fed98d71d040b31035822215505e1c9f4d)), closes [#52](https://github.com/protectwise/troika/issues/52)





## [0.27.1](https://github.com/protectwise/troika/compare/v0.27.0...v0.27.1) (2020-06-05)


### Bug Fixes

* **troika-3d-text:** fix shader error when casting shadows from text ([0c9277d](https://github.com/protectwise/troika/commit/0c9277d3b53b8becb4bcab7f8f3b66ebfbc48963))





# [0.27.0](https://github.com/protectwise/troika/compare/v0.26.1...v0.27.0) (2020-06-02)


### Bug Fixes

* **troika-3d-text:** prevent error when transpiling down to es5 ([7264b0c](https://github.com/protectwise/troika/commit/7264b0cee7aa5fc5df08102a77fbfc8f6be5ba3e)), closes [#51](https://github.com/protectwise/troika/issues/51)


### Features

* **troika-3d:** add three.js r117 to supported version range ([2761f39](https://github.com/protectwise/troika/commit/2761f39c272ecacd1dc0ce4f4cab8f166d373e90))
* **troika-core:** add `update` convenience method to all facades ([7403be1](https://github.com/protectwise/troika/commit/7403be11df184a0c47e6ae84fb5b91418cb74a8b))
* **troika-examples:** flexbox example: globe pokes through bg, add scrollable lists ([074c620](https://github.com/protectwise/troika/commit/074c62066924ceb55317b9d51a755d63044758ad))





## [0.26.1](https://github.com/protectwise/troika/compare/v0.26.0...v0.26.1) (2020-05-26)


### Bug Fixes

* **troika-worker-modules:** silence fallback warning in non-browser environments ([3dedb8f](https://github.com/protectwise/troika/commit/3dedb8f2b338e9345c107831863152b115ca50d2))





# [0.26.0](https://github.com/protectwise/troika/compare/v0.25.0...v0.26.0) (2020-05-24)


### Bug Fixes

* **troika-3d-text:** [#46](https://github.com/protectwise/troika/issues/46) fix error on script load when `document` not present ([1b005ec](https://github.com/protectwise/troika/commit/1b005ec0b4fb45b0b96cbb3270627de569f51b0e))


### Features

* **examples:** add example showing a resizable flexbox layout ([8f4d50d](https://github.com/protectwise/troika/commit/8f4d50d9e4dfbbdd83ce528bc636738ea1677262))
* **troika-3d-text:** experimental `colorRanges` feature ([c4971c3](https://github.com/protectwise/troika/commit/c4971c3b10dff597fb071b2039a6874df99c70a9))
* **troika-worker-utils:** add main thread fallback when web workers are not allowed ([c754d0b](https://github.com/protectwise/troika/commit/c754d0b2e716eadb2e478bb12fb2880d8a4ad63f))





# [0.25.0](https://github.com/protectwise/troika/compare/v0.24.1...v0.25.0) (2020-05-19)


### Bug Fixes

* **troika-3d:** fix error in InstancingManager on uniforms with default value of 0 ([8d2cc83](https://github.com/protectwise/troika/commit/8d2cc8339de34abd904c5e2e9fbd9ed449a57144))
* **troika-3d:** fix errors due to excessively deep BoundingSphereOctrees ([a4b5797](https://github.com/protectwise/troika/commit/a4b5797811ef0e15e9ee0c029e4c8dc1c5e58542)), closes [#42](https://github.com/protectwise/troika/issues/42)
* **troika-3d-text:** avoid error if something tries to set textMaterial.shadowSide ([c09a3c1](https://github.com/protectwise/troika/commit/c09a3c19dd7a452e631587f35ed4ecfaf6777bf1))


### Features

* **troika-3d-text:** add events fired on text sync start and completion ([3e7d4e0](https://github.com/protectwise/troika/commit/3e7d4e0d278fc28fe897aa574aad329746e451a0))
* **troika-3d-text:** add original input parameters to textRenderInfo object ([e1ef963](https://github.com/protectwise/troika/commit/e1ef9637bf592f577c32e65c15b728f8229817ad))
* **troika-3d-text:** publicly expose getCaretAtPoint and getSelectionRects functions ([669b256](https://github.com/protectwise/troika/commit/669b256ecbc8131bf96db363f9ec8919bd65959a))


### Performance Improvements

* **troika-3d-text:** improve speed of glyph SDF generation by ~15-20% ([3718997](https://github.com/protectwise/troika/commit/3718997809efce1db9874a9c2cc0c8b03652eb29))





## [0.24.1](https://github.com/protectwise/troika/compare/v0.24.0...v0.24.1) (2020-05-04)


### Bug Fixes

* **troika-3d-text:** fix error parsing fonts with CFF glyph outlines; fixes [#40](https://github.com/protectwise/troika/issues/40) ([0114ea6](https://github.com/protectwise/troika/commit/0114ea6c596c9fee19e75872e9462128863a2046))






# [0.24.0](https://github.com/protectwise/troika/compare/v0.23.0...v0.24.0) (2020-04-27)


### Bug Fixes

* **troika-3d:** default Plane and Circle primitives' side and shadowSide to DoubleSide ([7704b0a](https://github.com/protectwise/troika/commit/7704b0aea544231315880352e0ddc263d7092625))
* **troika-3d-text:** change GlyphSegmentsQuadtree to not use  `class` ([7e4db6c](https://github.com/protectwise/troika/commit/7e4db6c56f81f48de80ba9e6cc48affae067678e))
* **troika-three-utils:** allow use of the timeUniform within glsl functions ([7354b9e](https://github.com/protectwise/troika/commit/7354b9ea03d7ffedd869ccc4bb496811a572deba))


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
