/** The wait the search starts from, in milliseconds. */
const FIRST_GUESS = 500;
/** How many times in a row the search halves or doubles the wait before taking it for 0 or for never. */
const MOST_STEPS = 16;
/** How close the search gets to the wait, in milliseconds. */
const PRECISION = 1;

/**
 * How long after the last digit the group being typed ends, in milliseconds, from `ends`, which tells whether it has
 * ended after a wait: the break model itself, asked as the game asks it, so that nothing of it is worked out again. From
 * a first guess, the wait is halved while the group would have ended, or doubled while it wouldn't, until it crosses;
 * then the two waits around the crossing are bisected. 0 if it ends at once, `Infinity` if no pause ends it.
 *
 * A model's answer only flips once as the wait grows, as a longer pause only says more for a break; one that flips more
 * than once gives one of the waits where it does.
 */
export function waitToEnd(ends: (wait: number) => boolean): number {
  if (ends(FIRST_GUESS)) {
    let long = FIRST_GUESS;
    for (let step = 0; step < MOST_STEPS; step++) {
      const short = long / 2;
      if (!ends(short)) {
        return bisect(short, long, ends);
      }
      long = short;
    }
    return 0;
  }
  let short = FIRST_GUESS;
  for (let step = 0; step < MOST_STEPS; step++) {
    const long = short * 2;
    if (ends(long)) {
      return bisect(short, long, ends);
    }
    short = long;
  }
  return Infinity;
}

/** The wait where `ends` flips, between a `short` one where it doesn't end and a `long` one where it does. */
function bisect(short: number, long: number, ends: (wait: number) => boolean): number {
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
