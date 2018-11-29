/*
 * Built-in easing functions for use in Troika animations. Any of the easings defined here
 * may be referred to within Tweens by their exported symbol name, or by reference.
 * 
 * The implementations here are roughly based on the logic from the jQuery Easing plugin
 * (original license blocks are maintained below for completeness), but they have been
 * significantly rewritten to use a single 0-1 time argument signature, converted to ES2015
 * syntax, and otherwise modified for succinctness or performance.
 */

const {pow, PI, sqrt} = Math
const HALF_PI = PI / 2
const TWO_PI = PI * 2


// factories for common easing function patterns
function makeInOut(inFn, outFn) {
  return t => t < 0.5 ? inFn(t * 2) * 0.5 : outFn(t * 2 - 1) * 0.5 + 0.5
}
function makeExpIn(exp) {
  return t => pow(t, exp)
}
function makeExpOut(exp) {
  return t => 1 - pow(1 - t, exp)
}
function makeExpInOut(exp) {
  return t => t < 0.5 ?
    pow(t * 2, exp) * 0.5 :
    (1 - pow(1 - (t * 2 - 1), exp)) * 0.5 + 0.5
}


export const linear = t => t

export const easeInQuad = makeExpIn(2)
export const easeOutQuad = makeExpOut(2)
export const easeInOutQuad = makeExpInOut(2)

export const easeInCubic = makeExpIn(3)
export const easeOutCubic = makeExpOut(3)
export const easeInOutCubic = makeExpInOut(3)

export const easeInQuart = makeExpIn(4)
export const easeOutQuart = makeExpOut(4)
export const easeInOutQuart = makeExpInOut(4)

export const easeInQuint = makeExpIn(5)
export const easeOutQuint = makeExpOut(5)
export const easeInOutQuint = makeExpInOut(5)

export const easeInSine = t => 1 - Math.cos(t * (HALF_PI))
export const easeOutSine = t => Math.sin(t * (HALF_PI))
export const easeInOutSine = t => -0.5 * (Math.cos(PI * t) - 1)

export const easeInExpo = t =>
  (t === 0) ? 0 : pow(2, 10 * (t - 1))

export const easeOutExpo = t =>
  (t === 1) ? 1 : 1 - pow(2, -10 * t)

export const easeInOutExpo = t =>
  (t === 0 || t === 1) ? t :
  t < 0.5 ?
    pow(2, 10 * (t * 2 - 1)) * 0.5 :
    (1 - pow(2, -10 * (t * 2 - 1))) * 0.5 + 0.5

export const easeInCirc = t =>
  1 - sqrt(1 - t * t)

export const easeOutCirc = t =>
  sqrt(1 - pow(t - 1, 2))

export const easeInOutCirc = makeInOut(easeInCirc, easeOutCirc)

export const easeInElastic = t =>
  (t === 0 || t === 1) ? t : 1 - easeOutElastic(1 - t)

export const easeOutElastic = t =>
  (t === 0 || t === 1) ? t :
    Math.pow(2, -10 * t) * Math.sin((t - 0.075) * TWO_PI / 0.3) + 1

export const easeInOutElastic = makeInOut(easeInElastic, easeOutElastic)

export const easeInBack = t =>
  t * t * (2.70158 * t - 1.70158)

export const easeOutBack = t =>
  (t -= 1) * t * (2.70158 * t + 1.70158) + 1

export const easeInOutBack = t => {
  const s = 1.70158 * 1.525
  return (t *= 2) < 1 ? 
    0.5 * (t * t * ((s + 1) * t - s)) : 
    0.5 * ((t -= 2) * t * ((s + 1) * t + s) + 2)
}

export const easeInBounce = t => 
  1 - easeOutBounce(1 - t)

export const easeOutBounce = t => 
  t < (1 / 2.75) ? 
    (7.5625 * t * t) :
  t < (2 / 2.75) ? 
    (7.5625 * (t -= (1.5 / 2.75)) * t + .75) :
  t < (2.5 / 2.75) ? 
    (7.5625 * (t -= (2.25 / 2.75)) * t + .9375) :
    (7.5625 * (t -= (2.625 / 2.75)) * t + .984375)

export const easeInOutBounce = makeInOut(easeInBounce, easeOutBounce)

// Aliases...?
// export {
//   easeInBack as swingFrom,
//   easeOutBack as swingTo,
//   easeInOutBack as swingFromTo,
//   easeOutBounce as bounce,
//   easeFrom
// }





// ===== License blocks from originating works: =====

/*
 * jQuery Easing v1.3 - http://gsgd.co.uk/sandbox/jquery/easing/
 *
 * Uses the built in easing capabilities added In jQuery 1.1
 * to offer multiple easing options
 *
 * TERMS OF USE - jQuery Easing
 *
 * Open source under the BSD License.
 *
 * Copyright Â© 2008 George McGinley Smith
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this list of
 * conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list
 * of conditions and the following disclaimer in the documentation and/or other materials
 * provided with the distribution.
 *
 * Neither the name of the author nor the names of contributors may be used to endorse
 * or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 *  COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 *  GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 *
*/

/*
 *
 * TERMS OF USE - EASING EQUATIONS
 *
 * Open source under the BSD License.
 *
 * Copyright Â© 2001 Robert Penner
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this list of
 * conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list
 * of conditions and the following disclaimer in the documentation and/or other materials
 * provided with the distribution.
 *
 * Neither the name of the author nor the names of contributors may be used to endorse
 * or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 *  COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 *  GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */
