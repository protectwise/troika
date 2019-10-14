const path = require('path')
const { spawn } = require('child_process')
const {
  copy,
  remove,
  ensureDir
} = require('fs-extra')
const replace = require('replace-in-file')

const { LERNA_ROOT_PATH } = process.env
if (!LERNA_ROOT_PATH) {
  throw new Error('Please execute `npm run build-physics` from the repository root.')
}

const rootDir = path.resolve(LERNA_ROOT_PATH)
const srcAmmoDir = path.resolve(rootDir, 'node_modules/ammo.js/')

const workingDir = path.resolve(rootDir, '.tmp')
const workingAmmoDir = path.resolve(workingDir, 'ammo.js/')
const workingAmmoOutputCompat = path.resolve(workingAmmoDir, 'builds/ammo.js')
const workingAmmoOutputWasm = path.resolve(workingAmmoDir, 'builds/ammo.wasm.js')

const destDir = path.resolve(rootDir, 'packages/troika-physics/libs')
const destPathCompat = path.resolve(destDir, 'troika-ammo.js')
const destPathWasm = path.resolve(destDir, 'troika-ammo.wasm.js')

const CUSTOM_BANNER = `
/* Custom WASM build for troika generated at ${new Date().toISOString()}
 * customizations:
 * - \`SINGLE_FILE\` WASM output to simplify portability when used with a web worker
 * - Closure compiler used
 * - Strip unused components (UTF8ToString)
 */
`

/**
 * NOTE: This expects the preceding `customizeAmmoCompat` function to have already run on the 
 * working directory's files, it only adds on additional options to generate WebAssmebly output.
 */
async function customizeAmmoWasm () {
  await replace({
    files: path.resolve(workingAmmoDir, 'make.py'),
    from: [
      '// This is ammo.js, a port of Bullet Physics to JavaScript. zlib licensed.',
      "wasm = 'wasm' in sys.argv",
      "closure = 'closure' in sys.argv",
      'EXPORTED_RUNTIME_METHODS=["UTF8ToString"]',
      'WASM=1 ', // First-occurrence only
    ],
    to: [
      `
// This is ammo.js, a port of Bullet Physics to JavaScript. zlib licensed. 
${CUSTOM_BANNER}
      `,
      "wasm = True", // Force WASM output
      "closure = True", // Force Closure compiler output (?)
      'EXPORTED_RUNTIME_METHODS=[]', // Strip unneeded UTF8ToString
      'WASM=1 -s SINGLE_FILE=1 ' // Generate WASM output with base64-encoded wasm output inline
    ]
  })
}

function dockerBuild () {
  return new Promise((resolve, reject) => {
    const child = spawn('docker-compose', ['up'], {
      cwd: workingAmmoDir
    })

    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
    child.on('close', (code) => {
      resolve(code)
    })
  })
}


async function buildTroikaAmmoCompat () {
  // Compatibility Ammo.js (ASM.js) just copied from pre-built source. 
  await copy(workingAmmoOutputCompat, destPathCompat)
  console.log(`buildTroikaAmmoWasm: copied to "${workingAmmoOutputCompat}" -> "${destPathCompat}"`)
}

async function buildTroikaAmmoWasm () {
  console.log('buildTroikaAmmoWasm: modifying ammo.js make.py')
  await customizeAmmoWasm()

  console.log('buildTroikaAmmoWasm: executing ammo.js build (docker-compose up)')
  const dockerExitCode = await dockerBuild()

  if (dockerExitCode === 0) {
    await copy(workingAmmoOutputWasm, destPathWasm)
    console.log(`buildTroikaAmmoWasm: copied to "${workingAmmoOutputWasm}" -> "${destPathWasm}"`)
  }
}

async function buildAmmo () {
  // await remove(destDir) // Nuke old output if needed

  // 0: Copy ammo.js source into a temporary working directory since we'll be mutating config files
  console.log('build-ammo: creating working directory in root (".tmp")')
  await ensureDir(workingDir)
  console.log(`build-ammo: copied "ammo.js" source to working dir: "${srcAmmoDir}" -> "${workingAmmoDir}"`)
  await copy(srcAmmoDir, workingAmmoDir)

  // Build fallback ASM.js output
  await buildTroikaAmmoCompat()

  // Build WASM output second, as it needs to further modify the build config files
  await buildTroikaAmmoWasm()

  console.log('build-ammo: cleaning up ".tmp"')
  await remove(workingDir) // Cleanup working dir
}

buildAmmo()
