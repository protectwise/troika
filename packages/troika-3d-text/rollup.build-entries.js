// Define custom Rollup build entry points for this package...

module.exports = {
  // Default package:
  "src/index.js": "troika-3d-text",

  // Secondary entry point for just the TextMesh class with its much smaller
  // dependency tree; this can then be used directly by Three.js projects without
  // pulling in unneeded Troika framework code:
  "src/index-textmesh-standalone.js": "textmesh-standalone"
}