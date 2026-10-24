import type { Values } from './break-model';

/**
 * What a break model that judges each run on its own, against the intervals around each of its places, as Terra
 * (`terra.ts`) and Mars (`mars.ts`) do, works out on the way to its steps (`steps.ts`), for developer mode to show step
 * by step. Indexed as the steps are: index i is the interval before digit i, so index 0 never has a value.
 */
export interface Workings {
  /** Each run, in the order of the steps' runs. */
  readonly runs: readonly RunWorkings[];
  /** The z at which a run's interval is as likely a break as a normal one: its evidence is 0 there. */
  readonly evenZ: number;
  /** The z at which a lone run, fully trusted, breaks: its evidence takes the prior to the break threshold there. */
  readonly breakZ: number;
  /** The smallest spread a run's z is counted in, in log-interval. */
  readonly spreadFloor: number;
  /** The unevenness at which a run is fully trusted, in log-interval. */
  readonly fullTrustUnevenness: number;
  /** How the runs' evidence adds up at each place, for a model that adds it up, as Mars does. */
  readonly pool?: PoolWorkings;
}

/** One run, judged against its neighbors at each place. */
export interface RunWorkings {
  /** The log of each interval, in log-milliseconds. */
  readonly logInterval: Values;
  /** The local pace: the neighbors' weighted mean log-interval. */
  readonly pace: Values;
  /** How uneven the run is around the place: the neighbors' spread of log-intervals. */
  readonly unevenness: Values;
  /** The spread the z is counted in: the unevenness, but never under the spread floor. */
  readonly spread: Values;
  /** How many spreads the log-interval is above the pace. */
  readonly z: Values;
  /** The log of how much likelier the interval is for a break than for a normal one, straight in z. */
  readonly evidence: Values;
  /** How much the run's verdict counts there besides its recency, from 0 to 1. */
  readonly trust: Values;
  /** How much the run counts for its age: its weight at a place is this times its trust there. */
  readonly recency: number;
}

/** How the runs' evidence adds up at each place: the prior, plus each run's evidence times its weight. */
export interface PoolWorkings {
  /** The log-odds of a break before any run says anything. */
  readonly prior: number;
  /** The log-odds over which a place is a break: those of the break threshold. */
  readonly threshold: number;
  /** The log-odds of a break at each place: the prior plus every run's weighted evidence. */
  readonly logOdds: Values;
  /** The weighted share of the runs whose own verdict at each place says break. */
  readonly agreement: Values;
  /**
   * The z the next run would need at each place to end its group there, if fully trusted: what its evidence must add
   * to the finished runs', which count the current decay less.
   */
  readonly nextRunZ: Values;
}
