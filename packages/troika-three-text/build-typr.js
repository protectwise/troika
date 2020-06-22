// This build file creates a static version of the Typr.js library used for
// processing fonts. It's isolated within a "factory" function wrapper so it can
// easily be marshalled into a web worker.

const fetch = require('node-fetch')
const fs = require('fs')

async function fetchText(url) {
  const response = await fetch(url)
  if (response.ok) {
    const text = await response.text()
    return text.replace(/\r\n/g, '\n')
  } else {
    throw new Error(response.statusText)
  }
}

async function buildTypr() {
  // NOTE: probably want to lock this to the last version of Typr before they stripped out
  // built-in support for some things like ligatures in favor of a much larger Harfbuzz wasm
  // plugin. We may need to fork Typr going forward if we need to merge future fixes.
  const typr = await fetchText('https://raw.githubusercontent.com/photopea/Typr.js/gh-pages/src/Typr.js')
  let typrU = await fetchText('https://raw.githubusercontent.com/photopea/Typr.js/gh-pages/src/Typr.U.js')

  const output = `
// Custom bundle of Typr.js (https://github.com/photopea/Typr.js) for use in troika-3d-text. 
// Original MIT license applies: https://github.com/photopea/Typr.js/blob/gh-pages/LICENSE

export default function() {

const window = self

// Begin Typr.js
${typr}
// End Typr.js

// Begin Typr.U.js
${typrU}
// End Typr.U.js

return Typr

}
`

  fs.writeFileSync('libs/typr.factory.js', output)
}


async function buildWoff2otf() {
  const tinyInflate = await fetchText('https://raw.githubusercontent.com/foliojs/tiny-inflate/master/index.js')
  const woff2otf = fs.readFileSync('src/woff2otf.js')

  const output = `
// Custom bundle of woff2otf (https://github.com/arty-name/woff2otf) with tiny-inflate 
// (https://github.com/foliojs/tiny-inflate) for use in troika-3d-text. 
// Original licenses apply: 
// - tiny-inflate: https://github.com/foliojs/tiny-inflate/blob/master/LICENSE (MIT)
// - woff2otf.js: https://github.com/arty-name/woff2otf/blob/master/woff2otf.js (Apache2)

export default function() {

// Begin tinyInflate
const tinyInflate = (function() {
  const module = {}
  ${tinyInflate}
  return module.exports
})()
// End tinyInflate

// Begin woff2otf.js
${woff2otf}
// End woff2otf.js

return function(buffer) {
  return convert_streams(buffer, tinyInflate)
}

}
`

  fs.writeFileSync('libs/woff2otf.factory.js', output)
}

buildTypr()
buildWoff2otf()
