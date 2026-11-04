/* eslint-env node */
const { LERNA_PACKAGE_NAME } = process.env

const entries = {
    'src/index.js': LERNA_PACKAGE_NAME,
    'src/webgpu/index.js': LERNA_PACKAGE_NAME + '.webgpu',
}

module.exports = entries