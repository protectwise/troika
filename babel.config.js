module.exports = api => {

  // NOTE: Babel is only used for running unit tests; Buble is used for the browser build.
  // Uses jest's BABEL_ENV=test for isolation
  if (api.env('test')) {
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

}
