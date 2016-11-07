const startedKey = 'runner➤started'
const pausedKey = 'runner➤paused'
const stoppedKey = 'runner➤stopped'

let runners = []
let nextFrameTimer = null

function noop() {}

function tick() {
  let now = Date.now()

  // Sync each runner, filtering out empty ones as we go
  let hasStoppedRunners = false
  for (let i = 0, len = runners.length; i < len; i++) {
    let runner = runners[i]
    if (runner.running) {
      runner._tick(now)
    }
    if (!runner.running) {
      hasStoppedRunners = true
    }
  }
  if (hasStoppedRunners) {
    runners = runners.filter(runner => runner.running)
  }

  // Queue next tick if there are still active runners
  nextFrameTimer = null
  if (runners.length) {
    queueFrame()
  }
}

function queueFrame() {
  if (!nextFrameTimer) {
    nextFrameTimer = requestAnimationFrame(tick)
  }
}

function startRunner(runner) {
  if (!runner.running) {
    runner.running = true
    runners.push(runner)
    queueFrame()
  }
}

function stopRunner(runner) {
  runner.running = false
}


/**
 * @class Runner
 * A container for {@link Tween} instances that handles invoking them on each animation frame.
 */
class Runner {
  constructor() {
    this.tweens = []
  }

  destructor() {
    this.tweens = null
    stopRunner(this)
    this.start = this.stop = this.tick = noop
  }

  /**
   * Add a tween to the runner. It will be invoked on the next frame, not immediately.
   * @param {Tween} tween
   */
  start(tween) {
    // If previously paused, update start time to account for the duration of the pause
    if (tween[pausedKey] && tween[startedKey]) {
      tween[startedKey] += (Date.now() - tween[pausedKey])
    } else if (!tween[startedKey]) {
      tween[startedKey] = Date.now()
    }
    tween[pausedKey] = null
    tween[stoppedKey] = false
    this.tweens.push(tween)

    // add runner to running runners
    startRunner(this)
  }

  /**
   * Remove a tween from the runner.
   * @param tween
   */
  stop(tween) {
    // queue tween for removal from list on next tick
    tween[stoppedKey] = true
    tween[pausedKey] = null
  }

  /**
   * Pause a tween; call `runner.start(tween)` to unpause it
   * @param tween
   */
  pause(tween) {
    if (!tween[pausedKey]) {
      tween[pausedKey] = Date.now()
    }
  }

  /**
   * Stop all running tweens.
   */
  stopAll() {
    if (this.tweens) {
      this.tweens.forEach(this.stop, this)
    }
  }

  _tick(now) {
    let tweens = this.tweens
    let hasStoppedTweens = false
    let hasRunningTweens = false

    // Sync each tween, filtering out old finished ones as we go
    for (let i = 0, len = tweens.length; i < len; i++) {
      let tween = tweens[i]
      if (!tween[stoppedKey] && !tween[pausedKey]) {
        // Sync the tween to current time
        let time = now - tween[startedKey]
        tween.gotoTime(time)
        hasRunningTweens = true

        // Queue for removal if we're past its end time
        if (tween.isDoneAtTime(time)) {
          this.stop(tween)
          if (tween.onDone) {
            tween.onDone()
          }
        }
      }
      if (tween[stoppedKey]) {
        hasStoppedTweens = true
      }
    }

    if (hasRunningTweens) {
      this.onTick()
    }

    // Prune list if needed
    // TODO perhaps batch this up so it happens less often
    if (hasStoppedTweens) {
      this.tweens = tweens.filter(tween => !tween[stoppedKey])

      // remove runner from running runners if it has no tweens left
      if (!this.tweens.length) {
        stopRunner(this)
        if (this.onDone) {
          this.onDone()
        }
      }
    }
  }

  /**
   * Override to specify a function that will be called at the end of every frame, after all
   * tweens have been updated.
   */
  onTick() {
    // abstract
  }

  /**
   * Override to specify a function that will be called after all running tweens have completed.
   */
  onDone() {
    // abstract
  }
}

export default Runner
