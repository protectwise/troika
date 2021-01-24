# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.38.0](https://github.com/protectwise/troika/compare/v0.37.0...v0.38.0) (2021-01-24)

**Note:** Version bump only for package troika-xr





# [0.37.0](https://github.com/protectwise/troika/compare/v0.36.1...v0.37.0) (2021-01-18)

**Note:** Version bump only for package troika-xr






## [0.36.1](https://github.com/protectwise/troika/compare/v0.36.0...v0.36.1) (2020-12-16)


### Bug Fixes

* **troika-xr:** destroy WristMountedUI contents when hidden ([5589ee2](https://github.com/protectwise/troika/commit/5589ee2edac6e36f707eb4cd833d39a0e36be875))





# [0.36.0](https://github.com/protectwise/troika/compare/v0.35.0...v0.36.0) (2020-12-04)


### Bug Fixes

* prevent error in WristMountedUI when gripPose is null ([755d560](https://github.com/protectwise/troika/commit/755d560a0b7824e5b1acfecd0fbc89b5ad27c853))
* use combined frustum for XR camera, using setProjectionFromUnion from three.js ([ff1b9ae](https://github.com/protectwise/troika/commit/ff1b9ae46e466e9dca2138f7ee47d96f466a548d))





# [0.35.0](https://github.com/protectwise/troika/compare/v0.34.2...v0.35.0) (2020-11-16)


### Features

* **troika-xr:** allow configuring framebufferScaleFactor, incl. ratios based on native ([f63c160](https://github.com/protectwise/troika/commit/f63c160cd4f57f195fc12b32a0c2e6227e7414ea))





## [0.34.2](https://github.com/protectwise/troika/compare/v0.34.1...v0.34.2) (2020-11-09)

**Note:** Version bump only for package troika-xr





# [0.34.0](https://github.com/protectwise/troika/compare/v0.33.1...v0.34.0) (2020-10-19)

**Note:** Version bump only for package troika-xr






## [0.33.1](https://github.com/protectwise/troika/compare/v0.33.0...v0.33.1) (2020-10-02)

**Note:** Version bump only for package troika-xr





# [0.33.0](https://github.com/protectwise/troika/compare/v0.32.0...v0.33.0) (2020-10-02)


### Bug Fixes

* add "sideEffects":false to package.json files to assist treeshaking ([61109b2](https://github.com/protectwise/troika/commit/61109b2e3d21dc794ef66b3f28cf63bbdd34150e))
* remove redundant "browser" and defunct "jsnext:main" fields from package.json files ([0abec40](https://github.com/protectwise/troika/commit/0abec40e3af06d3ae4d990bf198d871b46730f1f))





# [0.32.0](https://github.com/protectwise/troika/compare/v0.31.0...v0.32.0) (2020-09-16)

**Note:** Version bump only for package troika-xr





# [0.31.0](https://github.com/protectwise/troika/compare/v0.30.2...v0.31.0) (2020-08-11)

**Note:** Version bump only for package troika-xr





# [0.30.0](https://github.com/protectwise/troika/compare/v0.29.0...v0.30.0) (2020-07-16)

**Note:** Version bump only for package troika-xr





# [0.29.0](https://github.com/protectwise/troika/compare/v0.28.1...v0.29.0) (2020-07-06)


### Bug Fixes

* **troika-xr:** ensure correct initial transform of gltf objects on load ([49287f3](https://github.com/protectwise/troika/commit/49287f328dd89b595e9a4305603bad661decb756))





## [0.28.1](https://github.com/protectwise/troika/compare/v0.28.0...v0.28.1) (2020-06-17)

**Note:** Version bump only for package troika-xr





# [0.28.0](https://github.com/protectwise/troika/compare/v0.27.1...v0.28.0) (2020-06-09)

**Note:** Version bump only for package troika-xr





# [0.27.0](https://github.com/protectwise/troika/compare/v0.26.1...v0.27.0) (2020-06-02)

**Note:** Version bump only for package troika-xr





# [0.26.0](https://github.com/protectwise/troika/compare/v0.25.0...v0.26.0) (2020-05-24)

**Note:** Version bump only for package troika-xr





# [0.25.0](https://github.com/protectwise/troika/compare/v0.24.1...v0.25.0) (2020-05-19)

**Note:** Version bump only for package troika-xr





# [0.24.0](https://github.com/protectwise/troika/compare/v0.23.0...v0.24.0) (2020-04-27)

**Note:** Version bump only for package troika-xr





# [0.23.0](https://github.com/protectwise/troika/compare/v0.22.0...v0.23.0) (2020-04-16)

**Note:** Version bump only for package troika-xr





# [0.22.0](https://github.com/protectwise/troika/compare/v0.21.0...v0.22.0) (2020-04-02)


### Bug Fixes

* **troika-xr:** fix TargetRay transparency by rendering last w/o depth testing ([045ec27](https://github.com/protectwise/troika/commit/045ec27abe9c8946f245ee22e4502ccdf133c4ef))


### Performance Improvements

* **troika-xr:** avoid full update pass every frame in WristMountedUI ([4a4cd16](https://github.com/protectwise/troika/commit/4a4cd16680d2c63a05e94dac8820d2a1cd3a0eab))
* **troika-xr:** avoid setting grip material colors every frame ([d3f1246](https://github.com/protectwise/troika/commit/d3f12463b70a46c9a883289f022fa9a6b95f3ccc))





# [0.21.0](https://github.com/protectwise/troika/compare/v0.20.0...v0.21.0) (2020-03-27)

**Note:** Version bump only for package troika-xr





# [0.20.0](https://github.com/protectwise/troika/compare/v0.19.0...v0.20.0) (2020-03-16)


### Performance Improvements

* skip updating children of inactive wrist-mounted ui ([c1b93f1](https://github.com/protectwise/troika/commit/c1b93f18228e1c051a3941d15f6bd31a3a682e2d))





# [0.19.0](https://github.com/protectwise/troika/compare/v0.19.0-alpha.0...v0.19.0) (2020-02-28)


### Bug Fixes

* **troika-xr:** disable buggy experimental clickOnPoke feature ([46cff53](https://github.com/protectwise/troika/commit/46cff535f24e661e727714e12e05326c830d1a90))


### Features

* **troika-xr:** improved default target ray appearance ([3798d9e](https://github.com/protectwise/troika/commit/3798d9e9451763c12d0273bb7d6f027c4ae79621))





# [0.19.0-alpha.0](https://github.com/protectwise/troika/compare/v0.18.0...v0.19.0-alpha.0) (2020-02-22)


### Features

* **troika-xr:** add WristMountedUI component ([74f5b10](https://github.com/protectwise/troika/commit/74f5b108931c7bcee0c55de1e2fa3a4c26559a5b))





# [0.18.0](https://github.com/protectwise/troika/compare/v0.17.1...v0.18.0) (2020-02-21)

**Note:** Version bump only for package troika-xr
