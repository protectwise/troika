/* eslint-env worker */
/*
 * Based on: https://github.com/InfiniteLee/ammo-debug-drawer/blob/master/AmmoDebugDrawer.js
 * Troika adaptations:
 * - Writes to a flat Float32Array instead of to a THREE scene
 * - Run in a web worker using troika's worker-module features
 * - Supports transferring the output payload to the main thread to eliminate expensive cloning
 */

/**
 * Ammo Debug Drawer as a thenable worker module
 * @param {*} Thenable
 * @param {*} Ammo
 */
export default function getAmmoDebugDrawer (Thenable, Ammo, CONSTANTS) {
  const {
    MSG_HDR_SZ,
    MSG_TYPES,
    MSG_ITEM_SIZES,
    DEBUG_MAX_BUFFER_SIZE,
    DEBUG_MSG
  } = CONSTANTS

  const AMMO_DEBUG_CONSTANTS = {
    NoDebug: 0,
    DrawWireframe: 1,
    DrawAabb: 2,
    DrawFeaturesText: 4,
    DrawContactPoints: 8,
    NoDeactivation: 16,
    NoHelpText: 32,
    DrawText: 64,
    ProfileTimings: 128,
    EnableSatComparison: 256,
    DisableBulletLCP: 512,
    EnableCCD: 1024,
    DrawConstraints: 1 << 11, // 2048
    DrawConstraintLimits: 1 << 12, // 4096
    FastWireframe: 1 << 13, // 8192
    DrawNormals: 1 << 14, // 16384
    DrawOnTop: 1 << 15, // 32768
    MAX_DEBUG_DRAW_MODE: 0xffffffff
  }

  /**
   * An implementation of the btIDebugDraw interface in Ammo.js, for debug rendering of Ammo shapes
   * @class AmmoDebugDrawer
   * @param {Ammo.btCollisionWorld} world
   * @param {object} [options]
   */
  const AmmoDebugDrawer = function (world, options) {
    this.world = world
    options = options || {}

    this.debugDrawMode = options.debugDrawMode || AMMO_DEBUG_CONSTANTS.DrawWireframe
    var drawOnTop = this.debugDrawMode & AMMO_DEBUG_CONSTANTS.DrawOnTop || false

    this._debugOutput = new Float32Array(MSG_HDR_SZ + MSG_ITEM_SIZES.DEBUG) // There's only one "item" for debug drawer data, that contains all debug output geometry
    this._debugOutput[0] = MSG_TYPES.DEBUG_OUTPUT // Message type
    this._debugOutput[1] = 0 // MSG_ITEM_SIZES.DEBUG // Message length

    // Set initial values
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.NEEDS_UPDATE] = 0 // false
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.DRAW_ON_TOP] = +drawOnTop // false => 0
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.GEOM_DRAW_RANGE_IDX_START] = 0 // false
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.GEOM_DRAW_RANGE_IDX_END] = 0 // false

    this.index = 0

    this.enabled = false

    this.debugDrawer = new Ammo.DebugDrawer()
    this.debugDrawer.drawLine = this.drawLine.bind(this)
    this.debugDrawer.drawContactPoint = this.drawContactPoint.bind(this)
    this.debugDrawer.reportErrorWarning = this.reportErrorWarning.bind(this)
    this.debugDrawer.draw3dText = this.draw3dText.bind(this)
    this.debugDrawer.setDebugMode = this.setDebugMode.bind(this)
    this.debugDrawer.getDebugMode = this.getDebugMode.bind(this)
    this.debugDrawer.update = this.update.bind(this)
    this.debugDrawer.getTxOutput = this.update.bind(this)
    this.debugDrawer.handleTxReturn = this.handleTxReturn.bind(this)

    this.world.setDebugDrawer(this.debugDrawer)

    console.info('Physics Debug Drawer ready')
  }

  AmmoDebugDrawer.prototype = function () {
    return this.debugDrawer
  }

  AmmoDebugDrawer.prototype.update = function () {
    if (!this.enabled || this._payloadLocked) {
      return false
    }

    if (this.index !== 0) {
      this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.NEEDS_UPDATE] = 1 // true
    } else {
      this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.NEEDS_UPDATE] = 0 // true
    }

    this.index = 0

    this.world.debugDrawWorld()

    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.GEOM_DRAW_RANGE_IDX_START] = 0
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.GEOM_DRAW_RANGE_IDX_END] = this.index

    if (this.index > DEBUG_MAX_BUFFER_SIZE) {
      console.warn(`AmmoDebugDrawer: Max buffer size exceeded (${this.index} > ${DEBUG_MAX_BUFFER_SIZE}), viausl artifacts will be present in debug wireframes (missing geometry, etc.)`)
    }

    return true
  }

  AmmoDebugDrawer.prototype.drawLine = function (from, to, color) {
    const heap = Ammo.HEAPF32
    const r = heap[(color + 0) / 4]
    const g = heap[(color + 4) / 4]
    const b = heap[(color + 8) / 4]

    const fromX = heap[(from + 0) / 4]
    const fromY = heap[(from + 4) / 4]
    const fromZ = heap[(from + 8) / 4]

    const fromI = this.index * 3

    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.POSITIONS_BASE + fromI + 0] = fromX
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.POSITIONS_BASE + fromI + 1] = fromY
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.POSITIONS_BASE + fromI + 2] = fromZ

    const colorFromI = this.index++ * 3
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.COLORS_BASE + colorFromI + 0] = r
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.COLORS_BASE + colorFromI + 1] = g
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.COLORS_BASE + colorFromI + 2] = b

    const toX = heap[(to + 0) / 4]
    const toY = heap[(to + 4) / 4]
    const toZ = heap[(to + 8) / 4]

    const toI = this.index * 3
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.POSITIONS_BASE + toI + 0] = toX
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.POSITIONS_BASE + toI + 1] = toY
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.POSITIONS_BASE + toI + 2] = toZ

    const colorToI = this.index++ * 3
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.COLORS_BASE + colorToI + 0] = r
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.COLORS_BASE + colorToI + 1] = g
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.COLORS_BASE + colorToI + 2] = b
  }

  // TODO: figure out how to make lifeTime work
  AmmoDebugDrawer.prototype.drawContactPoint = function (pointOnB, normalOnB, distance, lifeTime, color) {
    const heap = Ammo.HEAPF32
    const r = heap[(color + 0) / 4]
    const g = heap[(color + 4) / 4]
    const b = heap[(color + 8) / 4]

    const x = heap[(pointOnB + 0) / 4]
    const y = heap[(pointOnB + 4) / 4]
    const z = heap[(pointOnB + 8) / 4]

    const i = this.index * 3
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.POSITIONS_BASE + i + 0] = x
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.POSITIONS_BASE + i + 1] = y
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.POSITIONS_BASE + i + 2] = z

    const colorI = this.index++ * 3
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.COLORS_BASE + colorI + 0] = r
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.COLORS_BASE + colorI + 1] = g
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.COLORS_BASE + colorI + 2] = b

    const dx = heap[(normalOnB + 0) / 4] * distance
    const dy = heap[(normalOnB + 4) / 4] * distance
    const dz = heap[(normalOnB + 8) / 4] * distance

    const dI = this.index * 3
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.POSITIONS_BASE + dI + 0] = x + dx
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.POSITIONS_BASE + dI + 1] = y + dy
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.POSITIONS_BASE + dI + 2] = z + dz

    const colorDI = this.index++ * 3
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.COLORS_BASE + colorDI + 0] = r
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.COLORS_BASE + colorDI + 1] = g
    this._debugOutput[MSG_HDR_SZ + DEBUG_MSG.COLORS_BASE + colorDI + 2] = b
  }

  AmmoDebugDrawer.prototype.reportErrorWarning = function (warningString) {
    if (Ammo.hasOwnProperty('Pointer_stringify')) {
      console.warn(Ammo.Pointer_stringify(warningString))
    } else if (!this.warnedOnce) {
      this.warnedOnce = true
      console.warn("Cannot print warningString, please rebuild Ammo.js using 'debug' flag")
    }
  }

  AmmoDebugDrawer.prototype.draw3dText = function (location, textString) {
    // TODO
    console.warn('TODO: draw3dText')
  }

  AmmoDebugDrawer.prototype.setDebugMode = function (debugMode) {
    this.debugDrawMode = debugMode
  }

  AmmoDebugDrawer.prototype.getDebugMode = function () {
    return this.debugDrawMode
  }

  AmmoDebugDrawer.prototype.getTxOutput = function () {
    this._payloadLocked = true
    return this._debugOutput
  }

  // Handle a transferrable payload returned from main thread
  AmmoDebugDrawer.prototype.handleTxReturn = function (data /* Float32Array */) {
    this._debugOutput = data
    this._payloadLocked = false
  }

  return AmmoDebugDrawer
}
