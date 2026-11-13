/**
 * How much of their opacity the digits fading out of the tape keep, as Discover hands a turn over, `left` of the fade
 * left, from 1 down to 0: easing in, the fade speeds up from their opacity, never slowing down, so that it drops the
 * last of it at once.
 */
export function fadeOpacity(left: number): number {
  const done = 1 - Math.min(1, Math.max(0, left));
  return 1 - done * done;
}
