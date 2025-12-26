module.exports = api => {
  // NOTE: Babel is only used for running unit tests; Buble is used for the browser build.
  // Cache based on NODE_ENV
  api.cache.using(() => process.env.NODE_ENV);

  return {
    "presets": [
      [
        "@babel/preset-env",
        {
          "targets": {
            "node": "current"
          }
        }
      ],
      "@babel/preset-react"
    ]
  }
}
