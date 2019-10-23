# `troika-physics`
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

> TODO: description

## Usage

```
const troikaPhysics = require('troika-physics');

// TODO: DEMONSTRATE API
```

## About Ammo.js and Bullet Physics
ammo.js (the initial engine used for `troika-physics`) is a javascript port of the Bullet physics engine.

##### Resources:
* [Bullet Physics Manual](http://www.cs.kent.edu/~ruttan/GameEngines/lectures/Bullet_User_Manual)
* [Bullet API Documentation](https://pybullet.org/Bullet/BulletFull/index.html)
* [Bullet QuickStart Guide](https://docs.google.com/document/d/10sXEhzFRSnvFcl3XxNGhnD4N2SedqwdAvK3dsihxVUA/edit#heading=h.czaspku18mzs)
* [Great Resource for Collisions](https://github.com/AndresTraks/BulletSharp/wiki/Collision-Callbacks-and-Triggers)

## Roadmap/TODO
- [x] Rigid Bodies
  - [x] Instancing Support (via `InstanceableObject3DFacade`)
  - [x] `onCollision` events
- [x] Soft Bodies/Volumes (experimental)
  - [ ] Instancing Support
  - [ ] `onCollision` events
- [ ] Collision Filtering
- [ ] Constraints
- [ ] Collision Shape caching/sharing/manager
- [x] Handle changes to `physics` properties (mass, restitution, friction, etc.) while simulation is running
- [x] Kinematic Bodies (use `isKinematic: true`)
- [x] Static Bodies (`isStatic: true`)
- [ ] CoM (Center of Mass) handling
- [ ] Simpler user-specified collider configuration
- [x] Inlined Ammo.js WASM engine, for simpler distribution
- [x] Custom Ammo.js build
- [ ] Fallback to ASM.js Ammo build if WASM is unsupported

## External docs and useful information

### Ammo Soft Body configuration
Ammo/Bullet Soft Body `cfg` properties. Set via `cfg.set_<prop>(..args)`.
```
eAeroModel::_                   aeromodel;      // Aerodynamic model (default: V_Point)
btScalar                        kVCF;           // Velocities correction factor (Baumgarte)
btScalar                        kDP;            // Damping coefficient [0,1]
btScalar                        kDG;            // Drag coefficient [0,+inf]
btScalar                        kLF;            // Lift coefficient [0,+inf]
btScalar                        kPR;            // Pressure coefficient [-inf,+inf]
btScalar                        kVC;            // Volume conversation coefficient [0,+inf]
btScalar                        kDF;            // Dynamic friction coefficient [0,1]
btScalar                        kMT;            // Pose matching coefficient [0,1]              
btScalar                        kCHR;           // Rigid contacts hardness [0,1]
btScalar                        kKHR;           // Kinetic contacts hardness [0,1]
btScalar                        kSHR;           // Soft contacts hardness [0,1]
btScalar                        kAHR;           // Anchors hardness [0,1]
btScalar                        kSRHR_CL;       // Soft vs rigid hardness [0,1] (cluster only)
btScalar                        kSKHR_CL;       // Soft vs kinetic hardness [0,1] (cluster only)
btScalar                        kSSHR_CL;       // Soft vs soft hardness [0,1] (cluster only)
btScalar                        kSR_SPLT_CL;    // Soft vs rigid impulse split [0,1] (cluster only)
btScalar                        kSK_SPLT_CL;    // Soft vs rigid impulse split [0,1] (cluster only)
btScalar                        kSS_SPLT_CL;    // Soft vs rigid impulse split [0,1] (cluster only)
btScalar                        maxvolume;      // Maximum volume ratio for pose
btScalar                        timescale;      // Time scale
int                             viterations;    // Velocities solver iterations
int                             piterations;    // Positions solver iterations
int                             diterations;    // Drift solver iterations
int                             citerations;    // Cluster solver iterations
int                             collisions;     // Collisions flags
tVSolverArray                   m_vsequence;    // Velocity solvers sequence
tPSolverArray                   m_psequence;    // Position solvers sequence
tPSolverArray                   m_dsequence;    // Drift solvers sequence
```