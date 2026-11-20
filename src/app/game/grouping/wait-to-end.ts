/** The shortest wait told apart from none, in milliseconds: a group that ends sooner, but not at once, ends at about this. */
const SHORTEST_WAIT = 50;
/**
 * How far the game looks for the wait that ends the group being typed, in milliseconds, a minute at a time: as far as the
 * next whole minute waited, longer than a player pauses within a group. Past it, it looks again once the player has
 * waited that long, so that the many groups no likely pause ends cost a few answers of the break model rather than a
 * dozen.
 */
export const LOOK_AHEAD = 60_000;
/**
 * How close the search gets to the wait, as a share of it: a twentieth, less than two pauses differ by before a player
 * tells them apart.
 */
export const PRECISION = 0.05;

/**
 * How long after the last digit the group being typed ends, in milliseconds, from `ends`, which tells whether it has
 * ended after a wait: the break model itself, asked as the game asks it, so that nothing of it is worked out again.
 * After no wait at all and the `longest` looked at, the waits from {@link SHORTEST_WAIT} to it are bisected on a log
 * scale, each wait asked about the geometric mean of the two it lies between, to within {@link PRECISION} of the wait.
 * Each answer fits the runs again, so that takes a dozen of them at most, however long the wait. 0 if it ends at once,
 * `Infinity` if no pause up to `longest` ends it.
 *
 * A model's answer only flips once as the wait grows, as a longer pause only says more for a break; one that flips more
 * than once gives one of the waits where it does.
 */
export function waitToEnd(ends: (wait: number) => boolean, longest: number): number {
  if (ends(0)) {
    return 0;
  }
  if (!ends(longest)) {
    return Infinity;
  }
  let short = SHORTEST_WAIT;
  let long = longest;
  while (long > short * (1 + PRECISION)) {
    const middle = Math.sqrt(short * long);
    if (ends(middle)) {
      long = middle;
    } else {
      short = middle;
    }
  }
  return long;
}
