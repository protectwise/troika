---
id: animations-and-transitions
title: Animations and Transitions
---

Troika has built-in support for declarative transitions and animations on the properties of _any_ Facade, controlled via `transition` and `animation` properties in the [scene descriptors](./scene-descriptors.md). These generally work very much like [CSS transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Transitions/Using_CSS_transitions) and [CSS animations](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations/Using_CSS_animations), so they should be very familiar to web developers.

> Note: These transitions and animations are driven by the [troika-animation package](https://github.com/protectwise/troika/tree/master/packages/troika-animation). Facade classes are automatically [extended to intercept property changes](https://github.com/protectwise/troika/blob/master/packages/troika-core/src/facade/Animatable.js) and apply transitions when needed.

## Transitions

Any descriptor can be given a `transition` property to automatically intercept changes to certain properties and animate from their previous values to their new values. 

The `transition` property should be an object with transitionable property names as keys, and transition specs as values. Those specs can either be objects describing the transition parameters, or `true` for a default transition.

Troika supports both traditional duration-based transitions, like CSS, but also supports "spring" animations ala [react-spring](https://www.react-spring.io/). Spring animations can often give a more natural feel and behave better when target values change repeatedly during transition, but duration-based transitions can be more predictable. Use the approach that fits your case.

A basic example of a descriptor object that defines transitions for its `x`, `y`, and `z` properties:

```js
{
  facade: MyObject,
  x: xVal,
  y: yVal,
  z: zVal,
  transition: {
    x: true, // uses a default duration-based transition
    y: 'spring', //uses a default spring-based transition
    z: { //detailed transition parameters:
      duration: 500,
      easing: 'easeOutExpo'
    }
  }
}
```

When this descriptor is next applied with new values for `x`, `y`, and `z`, those values will be individually transitioned based on their configured parameters. That simple!
 
The custom transition config object can take one of two forms for duration- vs. spring-based animations:

### Duration-based

```js
transition: {
  z: {
    duration: 1234, //in ms, defaults to 750
    easing: 'easeInOutBounce', //easing function, defaults to 'easeOutCubic'
    delay: 123, //in ms, defaults to 0
    interpolate: 'number' //see "Interpolation" below
  }
}
```

### Spring-based

```js
transition: {
  myProp: {
    spring: true,
    // or spring: 'wobbly',
    // or spring: {mass, tension, friction},
    delay: 250 //in ms, defaults to 0
  }
}
```

The meanings of the spring configuration parameters, and the named presets, match those from [react-spring](https://www.react-spring.io/docs/hooks/api).

> Note: Spring-based transitions do not currently support custom interpolations so they should only be used for numeric values.


## Animations

Any descriptor can be given an `animation` property to define one or more keyframe animations for certain properties. Any animations will start running when the Facade is created and added to the scene. If any aspect of the `animation` is changed later, the old animation will be stopped and the new one will be started.

Here's an example of an animation that will rotate the object indefinitely, looping every 1.5 seconds:

```js
{
  facade: MyObject,
  animation: {
    0: {rotateY: 0},
    100: {rotateY: Math.PI * 2},
    duration: 1500,
    iterations: Infinity
  }
}
```

### Animation Spec Structure

#### keyframes

  All animations need at least two keyframes. They are defined by numeric properties from `0` for the first frame to `100` for the last frame, or any number in between. Also the special property names `'from'` and `'to'` are aliases for `0` and `100` respectively.
  
  Each keyframe value is an object holding a set of properties and their target values at that keyframe. The values will be interpolated between the keyframes as the animation runs, applying them to the Facade instance.

#### duration

The number of milliseconds over which the animation's keyframes are run. If the animation loops (see `iterations`), this is the length of one iteration.

#### delay

A number of milliseconds to wait before starting the animation's first frame.

#### easing

An easing function for the animation, defaulting to "linear". This is applied to the whole animation's progression of keyframes, not individual keyframe segments.

#### iterations

The number of times the animation should loop, defaulting to `1`. To loop endlessly, give it the value `Infinity`.

#### direction

Which direction the animation should progress: `"forward"` (the default), `"backward"`, or `"alternate"` to toggle between forward and backward every other iteration.

#### interpolate

Defines how non-numeric animated values should be interpolated between keyframes. It takes an object whose keys are property names and values are [interpolators](#Interpolation). For example:

```js
interpolate: {
  emissive: 'color'
}
```

#### paused

If `true`, the animation will be paused at its current keyframe. This can be toggled on and off to pause and unpause the animation.


## Exit Animations

Since they start when a Facade instance "enters" the scene, it's often convenient to think of `animation` as defining "entrance animations." Troika also supports "exit animations" which are applied when an object is removed from the scene. It will temporarily keep that object present in the scene long enough to run its exit animation, before fully destroying it. This allows you to do things like a nice smooth fade-out, scale-out, or fly-away rather than having objects abruptly disappear.

To define an exit animation, simply give the descriptor an `exitAnimation` property. Its value matches the structure of a regular `animation`.


## Interpolation

Transitions and animations will by default treat property values as numbers and interpolate their "tweened" values numerically. But some certain values, such as colors, require a different interpolation strategy.

Troika supports the following named interpolations:

- `"number"` - simple linear interpolation between two numeric values (the default).
- `"color"` - interprets the start/end values as RGB colors, and interpolates each color channel independently. The start/end values can be 24-bit integers or any CSS color string value, and the interpolated values will always be returned as 24-bit integers (8 bits red, 8 bits green, 8 bits blue.)

If you need a different interpolation, you can provide a custom function. Your function will take three parameters: the start value, the end value, and the progress between them (the output of the easing function) in the range from `0` to `1`. It must return an in-between value of the appropriate type.
