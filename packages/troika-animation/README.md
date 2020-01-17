# Troika Animation

This package provides a small library for "tweening" values over time, heavily optimized for performance. It is used by the Troika framework behind the scenes for its declarative `transition` and `animation` features, but can also be used as a standalone library.

## Installation

If you're using the Troika framework, you don't need to install this directly. If you want to use it standalone, you can get it from [NPM](https://www.npmjs.com/package/troika-animation):

```sh
npm install troika-animation
```

## Usage

To animate a value, you basically need to:

1. Create a `Tween` describing the start and end values, how the value should change over time, and a callback to invoke on each frame
2. Create a `Runner`
3. Start the tween in the runner

### Tween

> See the JSDoc comments in [Tween.js](./src/Tween.js) for more details about each parameter.

```js
import { Tween } from 'troika-animation'

function onTweenFrame(tweenedValue) {
  // ...do something with the tweenedValue
}

const tween = new Tween(
  onTweenFrame,  // callback
  -100,          // fromValue
  100,           // toValue
  5000,          // duration in ms
  0,             // delay
  'easeOutExpo', // easing
  1,             // iterations
  'forward',     // direction
  'number'       // interpolation
)
```

### MultiTween

This is a specialized `Tween` that, instead of managing a value, manages a list of other `Tween`s. It essentially creates a sub-timeline, whose playback is controlled as a whole. For example you can apply an `easing` to the entire set of tweens as a whole, stretch out their duration, repeat them, etc.

```js
import { MultiTween, Tween } from 'troika-animation'

const tween1 = new Tween(/*...*/)
const tween2 = new Tween(/*...*/)
const multiTween = new MultiTween(
  [tween1, tween2], // list of tweens
  5000,             // duration
  0,                // delay
  'easeInOutExpo',  // easing
  10,               // iterations
  'alternate'       // direction
)
```

### Runner

> Also see the JSDoc comments in [Runner.js](./src/Runner.js)

```js
import { Tween, Runner } from 'troika-animation'

const tween = new Tween(/*...*/)
const runner = new Runner()
runner.start(tween)
```


### Easings

When constructing a Tween, the `easing` parameter controls the rate of change over time. You can either specify a string, referring to the name of one of the built-in easing functions, or you can provide a custom easing function.

#### Built-in named easings

The built-in named easings can be found in [Easings.js](./src/Easings.js). These may be familiar, as they mostly match the ones provided by the popular [jQuery Easing Plugin](https://github.com/danro/jquery-easing/blob/master/jquery.easing.js) and [easings.net](https://easings.net).

There is also an online [demo of troika-animation easings](https://troika-examples.netlify.com/#easings) that shows the curve for each.

#### Custom easing functions

An easing function takes a single parameter `t`, which refers to the fraction of time passed in the tween's duration from 0 to 1. It must return a number specifying the progress between the start and end values at `t`; 0 corresponds to the start value and 1 corresponds to the end value. Most easings stay in the range from 0 to 1 but some may exceed it.


### Interpolation

The tween `interpolation` parameter controls how the fractional value returned from the `easing` is applied to the start and end values to calculate the in-between value. In most cases you're probably tweening two numbers, which is handled as the default interpolation. But if you have a different type of value, you may need to change the interpolator.

Two built-in interpolation types are provided, which can be referred to by their string names (see [Interpolators.js](./src/Interpolators.js))

- `"number"` - simple linear interpolation between two numeric values (the default).
- `"color"` - interprets the start/end values as RGB colors, and interpolates each color channel independently.

If you need a different interpolation, you can provide a custom function. It takes three parameters: the start value, the end value, and the progress between them (the output of the easing function.) It must return an in-between value of the appropriate type.
