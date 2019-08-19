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

async function run() {
  const typr = await fetchText('https://raw.githubusercontent.com/photopea/Typr.js/gh-pages/src/Typr.js')
  const typrU = await fetchText('https://raw.githubusercontent.com/photopea/Typr.js/gh-pages/src/Typr.U.js')
  // const typr = fs.readFileSync('libs/typr/src/Typr.js')
  // const typrU = fs.readFileSync('libs/typr/src/Typr.U.js')

  const output = `
// Custom bundle of Typr.js (https://github.com/photopea/Typr.js) for use in Troika text rendering. 
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

run()
