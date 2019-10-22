// Define custom Rollup build entry points for this package...

module.exports = {
  // Default package using the Ammo.js physics engine:
  "src/engines/ammo/index.js": "troika-physics-ammo",

  // Secondary entry point for smaller Oimo.js physics engine (rigid bodies only)
  // "src/engines/oimo/index.js": "troika-physics-oimo"
}