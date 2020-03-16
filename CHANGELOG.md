# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
