module.exports = {
  "env": {
    "browser": true,
    "es2021": true,
    "jest/globals": true
  },
  "extends": [
    "eslint:recommended"
  ],
  "globals": {
    "process": "readonly",
    "importScripts": "readonly"
  },
  "overrides": [
  ],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "plugins": [
    "jest"
  ],
  "rules": {
    "no-prototype-builtins": 0,
    "no-unused-vars": ["error", { "vars": "all", "args": "none" }]
  }
}
