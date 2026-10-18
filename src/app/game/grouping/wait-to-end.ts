/** The first wait looked at after none, in milliseconds. */
const FIRST_WAIT = 50;
/** The longest wait looked at, in milliseconds: a million seconds. A group no shorter pause ends never ends. */
export const LONGEST_WAIT = 1e9;
/** How close the search gets to the wait, in milliseconds. */
const PRECISION = 1;

/**
 * How long after the last digit the group being typed ends, in milliseconds, from `ends`, which tells whether it has
 * ended after a wait: the break model itself, asked as the game asks it, so that nothing of it is worked out again.
 * From no wait at all, then 50 ms, the wait is doubled until the group would have ended; then the last two waits are
 * bisected, to the millisecond. 0 if it ends at once, `Infinity` if no pause up to {@link LONGEST_WAIT} ends it.
 *
 * A model's answer only flips once as the wait grows, as a longer pause only says more for a break; one that flips more
 * than once gives one of the waits where it does.
 */
export function waitToEnd(ends: (wait: number) => boolean): number {
  if (ends(0)) {
    return 0;
  }
  let short = 0;
  let long = FIRST_WAIT;
  while (!ends(long)) {
    if (long >= LONGEST_WAIT) {
      return Infinity;
    }
    short = long;
    long = Math.min(2 * long, LONGEST_WAIT);
  }
  while (long - short > PRECISION) {
    const middle = (short + long) / 2;
    if (ends(middle)) {
      long = middle;
    } else {
      short = middle;
    }
  }
  return long;
}
