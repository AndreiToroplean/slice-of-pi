import type { TimedRun } from './break-models/break-model';

/** The even pace the places before a checkpoint are timed at when no earlier run got that far, in milliseconds. */
export const EVEN_INTERVAL = 300;

/** The break put just before a checkpoint a run starts from, in milliseconds: clearly longer than any interval. */
export const CHECKPOINT_BREAK = 3000;

/**
 * The times of a run starting from a place, as a break model that only takes runs from the start of π takes them,
 * place by place from there: the places before it as the latest earlier run from the start of π typed them, or at an
 * even pace if none got that far, then a clear break, then the run's own. A group then starts exactly at the place the
 * run starts from, and the player's groups are worked out from there as usual. From the start of π, the run's own
 * times, as they are.
 *
 * @param own The run's times, from its first digit.
 * @param earlier The earlier runs, oldest first.
 */
export function timesFromPlace(
  start: number,
  own: readonly number[],
  earlier: readonly TimedRun[],
): readonly number[] {
  if (start === 0) {
    return own;
  }
  const lead =
    [...earlier]
      .reverse()
      .find((run) => run.start === 0 && run.times.length > start)
      ?.times.slice(0, start) ?? Array.from({ length: start }, (_, i) => i * EVEN_INTERVAL);
  const offset = (lead.at(-1) ?? 0) + CHECKPOINT_BREAK;
  return [...lead, ...own.map((time) => time + offset)];
}
