# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.41.1](https://github.com/protectwise/troika/compare/v0.41.0...v0.41.1) (2021-04-26)


### Bug Fixes

* update bidi-js for fix removing type:module from package.json ([394c371](https://github.com/protectwise/troika/commit/394c37117042c28f6245aa3d1aa9a180ff8250bf))





# [0.41.0](https://github.com/protectwise/troika/compare/v0.40.0...v0.41.0) (2021-04-19)


### Bug Fixes

* **troika-core:** set animation/transition first when using .update() ([8ebf59d](https://github.com/protectwise/troika/commit/8ebf59dc9e933400f8302c0e5d99d15411b248c0))
* **troika-three-text:** fix Arabic word position letter forms ([480ee97](https://github.com/protectwise/troika/commit/480ee97426c219195d80733b04092018f9bbca86))
* **troika-three-text:** formatting characters no longer produce visible glyphs ([c0d28e8](https://github.com/protectwise/troika/commit/c0d28e8c05a2482c06f67a6d6fe9ea45fff39cd4))
* **troika-three-text:** more correct impl for character joining types ([2ce519a](https://github.com/protectwise/troika/commit/2ce519aa9b8f502f3f4af5cdd5447456958d036b))
* **troika-three-text:** prevent mutation of input to worldPositionToTextCoords method ([d487b8a](https://github.com/protectwise/troika/commit/d487b8aeaf3ca6831192587ee4d4c1bee978f90f))


### Features

* update support up to threejs r127 ([5b512f0](https://github.com/protectwise/troika/commit/5b512f04843f15bdaadd7297d6ab1d964c67333b))
* **troika-three-text:** add full bidi text support ([3fde850](https://github.com/protectwise/troika/commit/3fde850d28524393538e2bac8920f7a4ee0e1fb4))
* **troika-three-text:** simple bidi layout support, using explicit LRO/RLO/PDF chars only ([d511655](https://github.com/protectwise/troika/commit/d511655926f53262abb4b6c990c5102180f23f64))
* **troika-three-text:** very basic support for right-to-left text layout ([ce887be](https://github.com/protectwise/troika/commit/ce887beed7976ec23fa0590d5199457182c6e6bf))


### Performance Improvements

* prune some unused functions out of the Typr build ([26e669f](https://github.com/protectwise/troika/commit/26e669f5382fd8a160d1f9814e4329620ae2879b))





# [0.40.0](https://github.com/protectwise/troika/compare/v0.39.2...v0.40.0) (2021-02-28)


### Bug Fixes

* **troika-three-text:** fix boundingBox, boundingSphere, and raycasting with curveRadius ([7cc7c82](https://github.com/protectwise/troika/commit/7cc7c821eca8f7ae63170d9a484e806bc8814a94)), closes [#103](https://github.com/protectwise/troika/issues/103)


### Features

* **troika-3d:** add `initThreeObject` lifecycle method to Object3DFacade ([230a87d](https://github.com/protectwise/troika/commit/230a87df38c392ac54732561d67fb4eb46634dd8))
* **troika-3d:** remove need for manually defining material.instanceUniforms ([a234f8c](https://github.com/protectwise/troika/commit/a234f8c354b5fb5f54d13c58355887f02b7f32d8))





## [0.39.2](https://github.com/protectwise/troika/compare/v0.39.1...v0.39.2) (2021-02-18)


### Bug Fixes

* **troika-three-text:** fix shader error in WebGL1 ([cdbc7dc](https://github.com/protectwise/troika/commit/cdbc7dc0cac980a0317219a4736cb48ae4bc18eb)), closes [#108](https://github.com/protectwise/troika/issues/108)





## [0.39.1](https://github.com/protectwise/troika/compare/v0.39.0...v0.39.1) (2021-02-17)


### Bug Fixes

* **troika-three-text:** selection rects no longer clip off trailing whitespace ([158305c](https://github.com/protectwise/troika/commit/158305c9f3f83aa3729b2d32c1ae2d9112540348)), closes [#78](https://github.com/protectwise/troika/issues/78)





# [0.39.0](https://github.com/protectwise/troika/compare/v0.38.1...v0.39.0) (2021-02-15)


### Bug Fixes

* restore compatibility with three versions <0.113.0 by copying MathUtils.generateUUID ([35856b5](https://github.com/protectwise/troika/commit/35856b555919278b1addad0d2625faaaeb379757))


### Features

* **troika-core:** add requestRender method as nicer shortcut ([c79254c](https://github.com/protectwise/troika/commit/c79254c8be44f70f34b6c9cb9306a45892c3f4e9))
* **troika-three-text:** add curveRadius for applying cylindrical curvature ([6fdfbbf](https://github.com/protectwise/troika/commit/6fdfbbfcc0cdae0143555c9cb6569ba9e70150c5))
* **troika-three-text:** export a function for debugging SDF textures ([3fb0c23](https://github.com/protectwise/troika/commit/3fb0c23bae22b3812839c0639f8278d68120fc8c))
* **troika-three-text:** pack SDFs using all 4 color channels, to increase max glyphs in a texture ([d236caf](https://github.com/protectwise/troika/commit/d236caf9526b5b05bb14980f54f3d73a207ed874))
* **troika-xr:** add basic TeleportControls ([319ed29](https://github.com/protectwise/troika/commit/319ed2935a63fb8781410b47a6ffe3ad338f4a2b))





## [0.38.1](https://github.com/protectwise/troika/compare/v0.38.0...v0.38.1) (2021-02-03)


### Bug Fixes

* hoist vertexTransform defs to top of the shader to prevent errors in chained derivations ([889ed38](https://github.com/protectwise/troika/commit/889ed38fcfb30edc630865b6e95f59c3f6322646))
* update to support up to Three r125 ([4edff04](https://github.com/protectwise/troika/commit/4edff042d13dec49377d18baf4f958de285a3f2a))
* **three-instanced-uniforms-mesh:** prevent creation of multiple derived geometries ([94a7f67](https://github.com/protectwise/troika/commit/94a7f67967cd72e152d7942fbcce13ed0d5078cf))
* **three-instanced-uniforms-mesh:** the derived material is now prototype-chained to its base ([bf45d01](https://github.com/protectwise/troika/commit/bf45d01a56dac1ce3f873756109702da9a641e62))
* **troika-worker-utils:** properly track open requests count ([a01d903](https://github.com/protectwise/troika/commit/a01d903245eee3b9798bcfac7397108fb3bb03e7))
* make derived material's customProgramCacheKey function writable ([10289dd](https://github.com/protectwise/troika/commit/10289dd1fc700facff9ab79fb6e1cc04109fc0ff))
* **troika-three-text:** prevent copy() from sharing geometry between instances ([8c3ba2d](https://github.com/protectwise/troika/commit/8c3ba2d8f610c045dadee17a6221ea61ab8d26d4))
* add new text props to UI blocks ([a2d631f](https://github.com/protectwise/troika/commit/a2d631f3921263bf602282e22211bf869556f8a4))





# [0.38.0](https://github.com/protectwise/troika/compare/v0.37.0...v0.38.0) (2021-01-24)


### Bug Fixes

* **troika-three-text:** allow negative percentages for outlineOffsetX/Y ([3a274f0](https://github.com/protectwise/troika/commit/3a274f070b30e5312e2f546f66db2ab9352962ca)), closes [#100](https://github.com/protectwise/troika/issues/100)


### Features

* move InstancedUniformsMesh to its own three-instanced-uniforms-mesh package ([f623b1f](https://github.com/protectwise/troika/commit/f623b1f2307b0db094912246ee4cf4bef54ffd85))





# [0.37.0](https://github.com/protectwise/troika/compare/v0.36.1...v0.37.0) (2021-01-18)


### Features

* **troika-three-text:** added inner stroke and outline blur capabilities ([e004b9d](https://github.com/protectwise/troika/commit/e004b9d2f7e2ef9e841e61156b68958076533a62))
* add InstancedUniformsMesh class for setting shader uniforms per instance ([5fd4d79](https://github.com/protectwise/troika/commit/5fd4d797740096dc66a4da73f49961158e5bda2f))


### Performance Improvements

* **troika-three-text:** swap tiny-inflate to fflate for minor speed boost on woff fonts ([2ae29fa](https://github.com/protectwise/troika/commit/2ae29faffcec2302453ce9dabac633ade8181127))






## [0.36.1](https://github.com/protectwise/troika/compare/v0.36.0...v0.36.1) (2020-12-16)


### Bug Fixes

* **troika-three-text:** soften Typr.ts console warnings to debug level ([50d951f](https://github.com/protectwise/troika/commit/50d951fd06108194ef0a485af1fcce58c2710cde))
* **troika-xr:** destroy WristMountedUI contents when hidden ([5589ee2](https://github.com/protectwise/troika/commit/5589ee2edac6e36f707eb4cd833d39a0e36be875))





# [0.36.0](https://github.com/protectwise/troika/compare/v0.35.0...v0.36.0) (2020-12-04)


### Bug Fixes

* fix font parser build scripts ([e2d88fa](https://github.com/protectwise/troika/commit/e2d88fa0b838d9e0f67c133e046dbba999ff6bb0))
* prevent error in WristMountedUI when gripPose is null ([755d560](https://github.com/protectwise/troika/commit/755d560a0b7824e5b1acfecd0fbc89b5ad27c853))
* use combined frustum for XR camera, using setProjectionFromUnion from three.js ([ff1b9ae](https://github.com/protectwise/troika/commit/ff1b9ae46e466e9dca2138f7ee47d96f466a548d))
* **troika-three-text:** fix wrong caret position for collapsed ligature characters ([f220035](https://github.com/protectwise/troika/commit/f220035430787b3d178ad8cfe4b067fe9793de97))


### Features

* **troika-three-text:** fix kerning by updating from Typr.js to Typr.ts ([43144cf](https://github.com/protectwise/troika/commit/43144cfbb8f553d552a5bef179a7e5cfc8179fe3)), closes [#70](https://github.com/protectwise/troika/issues/70)





# [0.35.0](https://github.com/protectwise/troika/compare/v0.34.2...v0.35.0) (2020-11-16)


### Features

* **troika-xr:** allow configuring framebufferScaleFactor, incl. ratios based on native ([f63c160](https://github.com/protectwise/troika/commit/f63c160cd4f57f195fc12b32a0c2e6227e7414ea))
* initial support for spring physics-based transitions ([5e05bc8](https://github.com/protectwise/troika/commit/5e05bc8b0f2d0dd7af1f5f59f41c60929ac45ae2))





## [0.34.2](https://github.com/protectwise/troika/compare/v0.34.1...v0.34.2) (2020-11-09)


### Bug Fixes

* **troika-3d:** prevent tree getting in bad state due to removal of orphanable children ([8121425](https://github.com/protectwise/troika/commit/81214255cba846c4e832ac3ada3225e1688c59bd))
* **troika-three-text:** dispose the outline material when the base material is disposed ([68bd2c8](https://github.com/protectwise/troika/commit/68bd2c867f9ccbb53a41b2a3c3aedcf886354d38))
* **troika-three-text:** fix error when disposing the base material with outlines enabled ([73a51f5](https://github.com/protectwise/troika/commit/73a51f5ef87676727667becc0e6bbc6495bff751))






## [0.34.1](https://github.com/protectwise/troika/compare/v0.34.0...v0.34.1) (2020-10-20)


### Bug Fixes

* check for process env 'test' ([4f7f8f2](https://github.com/protectwise/troika/commit/4f7f8f24a9d4f4b655b61e1e16e19061c1911b02))
* check if process is undefined ([2b6d56a](https://github.com/protectwise/troika/commit/2b6d56af78e175a74fb03442efdc0a10d18fa4c8))





# [0.34.0](https://github.com/protectwise/troika/compare/v0.33.1...v0.34.0) (2020-10-19)


### Bug Fixes

* **troika-three-text:** clipRect is no longer clamped to the text block's bounds ([15edbd9](https://github.com/protectwise/troika/commit/15edbd95c0ec525c4a268ff3781e6e516981da02))
* **troika-three-text:** fix text baseline being positioned too low ([596d8ca](https://github.com/protectwise/troika/commit/596d8ca1e6ba35f9e68bcbda74329823a3b1b1ad))
* **troika-worker-utils:** pre-transpile the .esm build - issue [#84](https://github.com/protectwise/troika/issues/84) ([98248b6](https://github.com/protectwise/troika/commit/98248b6f7eff3090f0202e3e4507bb0d227510ba))


### Features

* **troika-three-text:** expose blockBounds and visibleBounds in textRenderInfo ([f3340ec](https://github.com/protectwise/troika/commit/f3340ec1efac6a6b00f596d9ef898ed7c2a6568a))
* **troika-three-text:** text outline and better antialiasing at small sizes ([3836809](https://github.com/protectwise/troika/commit/3836809cc919b57b5eb357e66e35a15903bd54f7))


### Performance Improvements

* micro-optimization of sdf texture insertion loop ([995c2a6](https://github.com/protectwise/troika/commit/995c2a6652181f26677b8da4207f18c32455e59c))






## [0.33.1](https://github.com/protectwise/troika/compare/v0.33.0...v0.33.1) (2020-10-02)

**Note:** Version bump only for package troika





# [0.33.0](https://github.com/protectwise/troika/compare/v0.32.0...v0.33.0) (2020-10-02)


### Bug Fixes

* add "sideEffects":false to package.json files to assist treeshaking ([61109b2](https://github.com/protectwise/troika/commit/61109b2e3d21dc794ef66b3f28cf63bbdd34150e))
* add PURE annotations to make troika-three-text treeshakeable ([8e76b5c](https://github.com/protectwise/troika/commit/8e76b5c31a3cbda86595654ba9d66d8d635e44a1))
* remove redundant "browser" and defunct "jsnext:main" fields from package.json files ([0abec40](https://github.com/protectwise/troika/commit/0abec40e3af06d3ae4d990bf198d871b46730f1f))
* **troika-three-text:** make `color` prop only apply to that instance when sharing a base material ([da0f995](https://github.com/protectwise/troika/commit/da0f995be3b7594bafc6f24dd6981ee787ff4ee1))


### Features

* **troika-three-text:** modifications to the base material are now picked up automatically ([fc81d3a](https://github.com/protectwise/troika/commit/fc81d3a13ef84a8358bfbdcac066cb13a161c7f6))
* **troika-three-utils:** add `chained` option to createDerivedMaterial ([2bfaa9c](https://github.com/protectwise/troika/commit/2bfaa9cd5a9ab9b936388e3c4f11e5d44e175eb7))





# [0.32.0](https://github.com/protectwise/troika/compare/v0.31.0...v0.32.0) (2020-09-16)


### Bug Fixes

* **troika-three-utils:** make derived material methods writable+configurable ([4d4bfbc](https://github.com/protectwise/troika/commit/4d4bfbc5d4d730eb0098d33beb1c3c562037fddf)), closes [react-spring/drei#121](https://github.com/react-spring/drei/issues/121)
* mutate boundingBox and set depth to 0 ([1f9b6be](https://github.com/protectwise/troika/commit/1f9b6bef083c26c9de9ac0ce169544ed3f99cf89))


### Features

* added boundingBox calculation ([140e9e8](https://github.com/protectwise/troika/commit/140e9e8bf2865c54f21877ca03834bbde4e9ab52))





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
