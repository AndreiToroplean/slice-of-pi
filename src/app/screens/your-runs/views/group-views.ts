import { ownBreak, padded } from './judged-views';
import { clamp, Plot, Point } from './plot';
import { niceStep, runsShown, stepTicks, ViewInput } from './view-input';

/**
 * The views of the groups the break model makes of the runs, along the digits of a group, from its first to its last:
 * how big the groups are, and how the player types within them.
 */

/** The largest group size the views of groups tell apart: larger ones count with it. */
const LARGEST_GROUP = 12;

/** The views of the groups: their sizes, then the time per digit within them. */
export function groupViews(input: ViewInput, mine: readonly number[]): Plot[] {
  return [groupSizesView(input, mine), withinGroupsView(input)];
}

/** How many digits there are between one break and the next, for the breaks at these indices. */
function sizesBetween(breaks: readonly number[]): number[] {
  return breaks.map((place, k) => place - (breaks[k - 1] ?? 0));
}

/**
 * How big the groups are: those the game plays, those each run shown breaks into on its own, and the player's own, as
 * shares of their groups, the last bin holding every larger one. None counts a group open at the end.
 */
export function groupSizesView(input: ViewInput, mine: readonly number[] = []): Plot {
  const { model, aggregate } = input;
  const played = model.groups.filter((group) => !group.open).map((group) => group.size);
  const own = runsShown(input).runs.flatMap((k) =>
    sizesBetween(
      (model.runs[k]?.breakProbability ?? []).flatMap((_, i) => (ownBreak(model, k, i) ? [i] : [])),
    ),
  );
  const shares = (sizes: readonly number[]): number[] => {
    const counts = new Array<number>(LARGEST_GROUP).fill(0);
    for (const size of sizes) {
      const bin = Math.min(LARGEST_GROUP, Math.max(1, size)) - 1;
      counts[bin] = (counts[bin] ?? 0) + 1;
    }
    return counts.map((count) => count / Math.max(1, sizes.length));
  };
  // Three bars to a size, side by side: the game's, each run's own, and the player's.
  const bars = (values: readonly number[], offset: number) =>
    values.map((height, bin) => ({
      from: bin + 1 + offset,
      to: bin + 1 + offset + 0.3,
      height,
    }));
  const playedShares = aggregate ? shares(played) : [];
  const ownShares = shares(own);
  const mineShares = mine.length > 0 ? shares(mine) : [];
  const top = Math.max(0.1, ...playedShares, ...ownShares, ...mineShares);
  return {
    title: 'Group sizes',
    caption: `How many digits the groups have, as shares of all of them, ${String(LARGEST_GROUP)} holding larger ones.`,
    x: { min: 0.5, max: LARGEST_GROUP + 0.5, labels: ['1 digit', `${String(LARGEST_GROUP)}+`] },
    y: { min: 0, max: top * 1.1, ticks: stepTicks(0, top, niceStep(top)) },
    legend: [
      { mark: 'bars', role: 'aggregate', label: 'The game’s groups' },
      { mark: 'bars', role: 'run', label: 'Each run’s own' },
      ...(mine.length > 0 ? ([{ mark: 'bars', role: 'break', label: 'Yours' }] as const) : []),
    ],
    layers: [
      { kind: 'bars', bars: bars(playedShares, -0.45), role: 'aggregate' },
      { kind: 'bars', bars: bars(ownShares, -0.15), role: 'run' },
      { kind: 'bars', bars: bars(mineShares, 0.15), role: 'break' },
    ],
  };
}

/**
 * Each interval of the runs shown over its baseline or pace, by where its digit comes in the game's group: 1 is its
 * first digit, so the pause before it, and the mean at each, so that a group's inner rhythm shows.
 */
export function withinGroupsView(input: ViewInput): Plot {
  const { model } = input;
  const { runs, role } = runsShown(input);
  const groups = model.groups.filter((group) => !group.open);
  const values: { readonly at: number; readonly residual: number; readonly breaks: boolean }[] = [];
  for (const k of runs) {
    const residuals = model.runs[k]?.residual ?? [];
    for (const group of groups) {
      for (let j = 0; j < group.size; j++) {
        const residual = residuals[group.start + j];
        if (residual !== undefined) {
          values.push({
            at: Math.min(LARGEST_GROUP, j + 1),
            residual,
            breaks: ownBreak(model, k, group.start + j),
          });
        }
      }
    }
  }
  const sorted = values.map(({ residual }) => residual).sort((a, b) => a - b);
  const range = padded(
    [
      0,
      sorted[Math.floor(0.005 * (sorted.length - 1))] ?? 0,
      sorted[Math.ceil(0.995 * (sorted.length - 1))] ?? 0,
    ],
    { min: -2, max: 4 },
  );
  // Each digit's dots spread across its place, so that they don't all fall on one line.
  const dots = (breaks: boolean): Point[] =>
    values
      .filter((value) => value.breaks === breaks)
      .map(({ at, residual }, n) => [
        at - 0.3 + 0.6 * ((n * 0.618034) % 1),
        clamp(residual, range),
      ]);
  const means = Array.from({ length: LARGEST_GROUP }, (_, j): Point | undefined => {
    const here = values.filter(({ at }) => at === j + 1);
    return here.length === 0
      ? undefined
      : [j + 1, clamp(here.reduce((sum, { residual }) => sum + residual, 0) / here.length, range)];
  });
  return {
    title: 'Within groups',
    caption: `Each interval over its ${model.workings === undefined ? 'baseline' : 'pace'}, on a log scale, by its digit in the game’s group: 1 is the pause before the group.`,
    x: { min: 0.5, max: LARGEST_GROUP + 0.5, labels: ['1st digit', `${String(LARGEST_GROUP)}th+`] },
    y: { ...range, ticks: stepTicks(range.min, range.max, niceStep(range.max - range.min)) },
    legend: [
      { mark: 'dots', role, label: 'Interval' },
      { mark: 'dots', role: 'break', label: 'A break on its own' },
      { mark: 'line', role: 'aggregate', label: 'Mean' },
    ],
    layers: [
      { kind: 'dots', points: dots(false), role },
      { kind: 'dots', points: dots(true), role: 'break' },
      { kind: 'line', points: means, role: 'aggregate' },
    ],
  };
}
