import type { BreakModelKind, Group, Hyperparameter, Settings } from './break-model';

/**
 * Fits a break model's hyperparameters to the groups a player says they make: a hyperparameter search, with the
 * player's groups as the labels and their runs as the data. Each set of values tried runs the model over the runs, as
 * the game would, and is scored by how well the breaks between its groups match the player's over all the runs; or,
 * fitting to the run-count curve, over fewer of them too, so that the values found also hold up while the player has
 * few runs.
 */

/** The breaks between the groups a player gave, by the index of the digit each comes before, over `digits` digits. */
export interface Labels {
  readonly breaks: ReadonlySet<number>;
  readonly digits: number;
}

/** The labels of groups of these sizes, in order from the first decimal. */
export function labelsOf(sizes: readonly number[]): Labels {
  const breaks = new Set<number>();
  let digits = 0;
  for (const size of sizes) {
    if (digits > 0) {
      breaks.add(digits);
    }
    digits += size;
  }
  return { breaks, digits };
}

/** How well a model's breaks match the labels. */
export interface Score {
  /** Breaks both have. */
  readonly matched: number;
  /** The model's breaks the labels don't have. */
  readonly extra: number;
  /** The labels' breaks the model doesn't have. */
  readonly missed: number;
  /** The F1 score of the model's breaks, from 0 to 1: 1 when they're the labels' exactly. */
  readonly f1: number;
}

/**
 * How well the breaks between groups match the labels, at the places both cover: before each digit after the first,
 * up to the last one labelled and the last one the groups reach.
 */
export function scoreGroups(groups: readonly Group[], labels: Labels): Score {
  const reached = Math.max(0, ...groups.map((group) => group.start + group.size));
  const end = Math.min(labels.digits, reached);
  const found = new Set(groups.map((group) => group.start));
  let matched = 0;
  let extra = 0;
  let missed = 0;
  for (let i = 1; i < end; i++) {
    const labelled = labels.breaks.has(i);
    if (found.has(i)) {
      if (labelled) {
        matched++;
      } else {
        extra++;
      }
    } else if (labelled) {
      missed++;
    }
  }
  const total = 2 * matched + extra + missed;
  return { matched, extra, missed, f1: total === 0 ? 1 : (2 * matched) / total };
}

/** The values of a slider, from its minimum to its maximum, a step apart. */
export function sliderValues({ min, max, step }: Hyperparameter): number[] {
  const decimals = (String(step).split('.')[1] ?? '').length;
  const count = Math.round((max - min) / step) + 1;
  return Array.from({ length: count }, (_, k) => Number((min + k * step).toFixed(decimals)));
}

/** The best hyperparameters found, and their score. */
export interface GroupingsFit {
  readonly settings: Settings;
  /**
   * From 0 to 1: the F1 score over all the runs; or, fitting to the curve, half that and half the mean F1 over sets of
   * fewer runs, 1 then 2 then 4 and so on, so as much for 1 run to 2 as for half the runs to all of them.
   */
  readonly score: number;
}

/** How far the search has gone. */
export type Progress = (
  | {
      /** Refining the values started from, in passes over the sliders, from 1. */
      readonly stage: 'yours';
      readonly pass: number;
    }
  | {
      /** Trying this many sets of values drawn at random across every slider. */
      readonly stage: 'drawing';
      readonly draws: number;
    }
  | {
      /** Refining the best draws, which one (from 1) of how many, in passes over the sliders, from 1. */
      readonly stage: 'pick';
      readonly pick: number;
      readonly picks: number;
      readonly pass: number;
    }
) & {
  /** How much of the draws, or of the pass, is done, from 0 to 1. */
  readonly done: number;
  /** The best found so far. */
  readonly best: GroupingsFit;
};

export interface FitOptions {
  /** Called after each set of values tried, with how far the search has gone, to show it and let the page draw. */
  readonly pause?: (progress: Progress) => Promise<void>;
  /** Stops the search, which then gives the best values found so far. */
  readonly signal?: AbortSignal;
  /** Whether to score over fewer runs too, so as to fit the run-count curve, not only its end (see `GroupingsFit.score`). */
  readonly curve?: boolean;
}

/** How many sets of values are drawn at random across every slider. */
const DRAWS = 300;
/** How many of the best of them are refined, besides the values the search starts from. */
const REFINED = 3;
/** Most sweeps over the sliders when refining: each finds less than the one before, so it's over well before. */
const MAX_SWEEPS = 8;
/** The seed of the random draws: the same every time, so a fit gives the same values for the same runs and groups. */
const SEED = 0x5eed;
/** How much of the score fitting to the curve is the F1 over all the runs, the rest being over fewer runs. */
const ALL_RUNS_SHARE = 0.5;
/** How many sets of runs are drawn at each number of runs fewer than all, to score over. */
const FIT_SETS_PER_COUNT = 2;

/**
 * Searches the hyperparameters of a break model that make its groups over the runs (oldest first) match the labels
 * best, over all of them or, fitting to the curve, fewer too (see `GroupingsFit.score`), starting from `start`. It refines `start` by coordinate descent over every value of every slider: each slider in
 * turn is moved to its best value, the others staying where they are, over and over until no move scores better. Then,
 * so as to look over the whole space, it tries values drawn at random across every slider, and refines the best of
 * them the same way. Values are only taken when they score strictly better, so of values that score alike, those found
 * first stay, those near `start` first of all.
 */
export async function fitToGroupings(
  kind: BreakModelKind,
  start: Settings,
  runs: readonly (readonly number[])[],
  labels: Labels,
  { pause, signal, curve = false }: FitOptions = {},
): Promise<GroupingsFit> {
  const sliders = kind.tabs.flatMap((tab) => tab.hyperparameters);
  const grids = sliders.map(sliderValues);
  const perSweep = grids.reduce((sum, grid) => sum + grid.length, 0);
  const sets = curve ? scoredSets(runs) : [{ runs, weight: 1 }];
  const fitOf = (settings: Settings): GroupingsFit => {
    const model = kind.create(settings);
    return {
      settings,
      score: sets.reduce(
        (sum, set) => sum + set.weight * scoreGroups(model.stats(set.runs).groups, labels).f1,
        0,
      ),
    };
  };
  const aborted = (): boolean => signal?.aborted === true;

  const first = fitOf({ ...kind.defaults, ...start });
  let best = first;
  const keep = (fit: GroupingsFit): void => {
    if (fit.score > best.score) {
      best = fit;
    }
  };

  /** Refines the values of a fit by coordinate descent, the best draw `pick` (from 1) or 0 for `start`; `false` if stopped. */
  const refine = async (from: GroupingsFit, pick: number): Promise<boolean> => {
    let at = from;
    for (let sweep = 1; sweep <= MAX_SWEEPS; sweep++) {
      let moved = false;
      let done = 0;
      for (const [s, slider] of sliders.entries()) {
        for (const value of grids[s] ?? []) {
          if (aborted()) {
            return false;
          }
          if (value !== at.settings[slider.key]) {
            const fit = fitOf({ ...at.settings, [slider.key]: value });
            if (fit.score > at.score) {
              at = fit;
              moved = true;
              keep(fit);
            }
          }
          done++;
          const stage =
            pick === 0
              ? { stage: 'yours' as const, pass: sweep }
              : { stage: 'pick' as const, pick, picks: REFINED, pass: sweep };
          await pause?.({ ...stage, done: done / perSweep, best });
        }
      }
      if (!moved) {
        break;
      }
    }
    return true;
  };

  if (!(await refine(first, 0))) {
    return best;
  }
  const random = mulberry32(SEED);
  const drawn: GroupingsFit[] = [];
  for (let k = 0; k < DRAWS; k++) {
    if (aborted()) {
      return best;
    }
    const fit = fitOf(
      Object.fromEntries(
        sliders.map(({ key }, s) => {
          const grid = grids[s] ?? [];
          return [key, grid[Math.floor(random() * grid.length)] ?? 0];
        }),
      ),
    );
    drawn.push(fit);
    keep(fit);
    await pause?.({ stage: 'drawing', draws: DRAWS, done: (k + 1) / DRAWS, best });
  }
  const bestDrawn = drawn.sort((a, b) => b.score - a.score).slice(0, REFINED);
  for (const [k, from] of bestDrawn.entries()) {
    if (!(await refine(from, k + 1))) {
      return best;
    }
  }
  return best;
}

/**
 * The sets of runs a fit to the curve scores over, each with its weight in the score, the weights adding up to 1: all the runs, and
 * sets of 1, 2, 4 and so on fewer, drawn at random once (each kept oldest first) and the same for every set of values.
 */
function scoredSets(
  runs: readonly (readonly number[])[],
): { readonly runs: readonly (readonly number[])[]; readonly weight: number }[] {
  const counts: number[] = [];
  for (let count = 1; count < runs.length; count *= 2) {
    counts.push(count);
  }
  const random = mulberry32(SEED);
  const fewer = counts.flatMap((count) =>
    Array.from({ length: FIT_SETS_PER_COUNT }, () => ({
      runs: drawSet(runs.length, count, random).map((index) => runs[index] ?? []),
      weight: (1 - ALL_RUNS_SHARE) / (counts.length * FIT_SETS_PER_COUNT),
    })),
  );
  return [{ runs, weight: fewer.length === 0 ? 1 : ALL_RUNS_SHARE }, ...fewer];
}

/** How many sets of runs the run-count curve draws at each count, but all of them: there's only one set of all. */
const SETS_PER_COUNT = 5;

export interface CurveOptions {
  /** Called after each set of runs scored, with how much of the curve is done, from 0 to 1. */
  readonly pause?: (done: number) => Promise<void>;
  /** Stops drawing the curve, which then gives the counts done so far. */
  readonly signal?: AbortSignal;
}

/**
 * The run-count curve of a configuration of a break model: at each number of runs, from 1 to all of them, the F1
 * scores against the labels of sets of that many runs drawn at random (each kept oldest first), so as to tell how well
 * the configuration holds up with fewer runs. By count, from 1.
 */
export async function runCountCurve(
  kind: BreakModelKind,
  settings: Settings,
  runs: readonly (readonly number[])[],
  labels: Labels,
  { pause, signal }: CurveOptions = {},
): Promise<number[][]> {
  const model = kind.create({ ...kind.defaults, ...settings });
  const random = mulberry32(SEED);
  const total = (runs.length - 1) * SETS_PER_COUNT + 1;
  const curve: number[][] = [];
  let scored = 0;
  for (let count = 1; count <= runs.length; count++) {
    const scores: number[] = [];
    for (let set = 0; set < (count === runs.length ? 1 : SETS_PER_COUNT); set++) {
      if (signal?.aborted === true) {
        return curve;
      }
      const picked = drawSet(runs.length, count, random).map((index) => runs[index] ?? []);
      scores.push(scoreGroups(model.stats(picked).groups, labels).f1);
      scored++;
      await pause?.(scored / total);
    }
    curve.push(scores);
  }
  return curve;
}

/** `count` indices out of `size`, drawn at random, in order. */
function drawSet(size: number, count: number, random: () => number): number[] {
  const indices = Array.from({ length: size }, (_, k) => k);
  for (let k = 0; k < count; k++) {
    const swap = k + Math.floor(random() * (size - k));
    [indices[k], indices[swap]] = [indices[swap] ?? 0, indices[k] ?? 0];
  }
  return indices.slice(0, count).sort((a, b) => a - b);
}

/** A small seeded random number generator, giving numbers from 0 (included) to 1 (excluded). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
