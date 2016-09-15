let runningTweens = []
let nextFrameTimer = null


function tick() {
  let now = Date.now()

  // Sync each tween, filtering out old finished ones as we go
  runningTweens = runningTweens.filter(tween => {
    if (tween.$runnerFinished) { return false }

    // Sync the tween to current time
    let time = now - tween.$runnerStartTime
    tween.gotoTime(time)

    // Queue for removal if we're past its end time
    if (tween.isDoneAtTime(time)) {
      stop(tween)
      if (tween.onDone) {
        tween.onDone()
      }
    }
    return true
  })

  // Queue next tick if there are still active tweens
  nextFrameTimer = null
  if (runningTweens.length) {
    queueFrame()
  }
}

function queueFrame() {
  if (!nextFrameTimer) {
    nextFrameTimer = requestAnimationFrame(tick)
  }
}

export function start(tween) {
  if (tween.$runnerStartTime) { //don't let a tween be started twice
    console.warn(`Tried to start the same tween more than once`)
  } else {
    tween.$runnerStartTime = Date.now()
    tween.$runnerFinished = false
    runningTweens.push(tween)
    //tween.gotoTime(0) //immediately sync to initial frame
    queueFrame()
  }
}

export function stop(tween) {
  tween.$runnerFinished = true
}