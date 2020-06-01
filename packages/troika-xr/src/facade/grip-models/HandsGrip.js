import { GLTFFacade } from './GLTFFacade.js'
import { AnimationMixer, Clock, LoopOnce, Matrix4 } from 'three'
import { BUTTON_SQUEEZE, BUTTON_TRIGGER } from '../../XRStandardGamepadMapping.js'


function getModelUrl (hand) {
  return `https://cdn.aframe.io/controllers/hands/${hand}HandHigh.glb`
}

// AFrame models are built assuming a targetRaySpace, but we use gripSpace, so
// these rootTransforms are offsets from targetRaySpace to gripSpace (as measured
// using controllers in Oculus browser), plus the Z rotation also applied by AFrame.
const MODEL_PARAMS = {
  left: {
    url: getModelUrl('left'),
    rootTransform: new Matrix4().set(0.9891952390780486, -0.055079804712322655, -0.135864030013094, 0, 0.134251874636802, 0.7126619830767638, 0.68854141828729, 0, 0.058900417593749754, -0.6993419911774881, 0.7123564071509296, 0, 0.022191358380132697, 0.3674491931926873, 0.46970496839747344, 1).multiply(new Matrix4().makeRotationZ(Math.PI / 2))
  },
  right: {
    url: getModelUrl('right'),
    rootTransform: new Matrix4().set(0.9991057478311871, -0.021268630839894498, 0.03654256702889458, 0, -0.010756123291139397, 0.7079848583317349, 0.7061457664971519, 0, -0.04089033411730017, -0.7059072584331106, 0.7071229985273267, 0, 0.014017117995823086, 0.35926713373523733, 0.5145142484388896, 1).multiply(new Matrix4().makeRotationZ(-Math.PI / 2))
  }
}

export class HandsGrip extends GLTFFacade {
  constructor (parent) {
    super(parent)
    this.xrInputSource = null
    this.currentClip = 'Open'
  }

  afterUpdate () {
    let hand = this.xrInputSource.handedness
    if (hand !== 'left' && hand !== 'right') {
      hand = 'left'
    }
    if (hand !== this._hand) {
      this._hand = hand
      Object.assign(this, MODEL_PARAMS[hand])
    }

    let mixer = this._mixer
    if (mixer) {
      let currentClip = this._animationsByName.get(this.getClipName())
      if (currentClip !== this._prevClip) {
        // adapted from https://github.com/aframevr/aframe/blob/master/src/components/hand-controls.js#playAnimation
        mixer.stopAllAction()

        let to = mixer.clipAction(currentClip)
        to.clampWhenFinished = true
        to.loop = LoopOnce
        to.timeScale = currentClip ? 1 : -1
        to.time = currentClip ? currentClip.duration : 0

        let from = this._prevClip ? mixer.clipAction(this._prevClip) : null
        if (from) {
          from.crossFadeTo(to, 0.1, true)
        }
        to.play()

        this._prevClip = currentClip
      }

      mixer.update(this._clock.getDelta())
    }

    super.afterUpdate()
  }

  onLoad(gltf) {
    this._mixer = new AnimationMixer(gltf.scene.children[0])
    this._clock = new Clock()

    this._animationsByName = new Map()
    gltf.animations.forEach(clip => {
      this._animationsByName.set(clip.name, clip)
    })

    super.onLoad(gltf)
  }

  getClipName() {
    let gamepad = this.xrInputSource.gamepad
    let buttons = gamepad && gamepad.buttons
    if (buttons) {
      let grabbing = buttons[BUTTON_SQUEEZE] && buttons[BUTTON_SQUEEZE].pressed
      let triggering = buttons[BUTTON_TRIGGER] && (buttons[BUTTON_TRIGGER].touched || buttons[BUTTON_TRIGGER].pressed)
      let thumbTouching = false
      for (let i = 2; i < buttons.length; i++) {
        if (buttons[i] && (buttons[i].touched || buttons[i].pressed)) {
          thumbTouching = true
          break
        }
      }
      return grabbing ? (
        thumbTouching ? (triggering ? 'Fist' : 'Point') : (triggering ? 'Thumb Up' : 'Point + Thumb')
      ) : triggering ? 'Hold' : 'Open'
    } else {
      return 'Open'
    }
  }
}
