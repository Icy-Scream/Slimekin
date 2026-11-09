// What the Game's parts (src/game/*.js) and game.js share, moved from game.js as it was: where the slime sits on the
// cushion, two bits of math, the debug switch and "a"/"an".
import { CUSHION_TOP } from '../view/stage.js';
import { isNative } from '../platform/index.js';

export const SLIME_Y = CUSHION_TOP - 0.03;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const DEBUG = location.hash === '#debug' && !isNative;   // no debug tools in the iPhone app
export const an = w => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;
