import { Hyperparameter } from './break-model';

/**
 * The hyperparameters of the break models that tell breaks by a baseline and a mixture (`steps.ts`), and the slider
 * each one has on Your Runs in developer mode, with what it means behind its help button. Each model picks those it
 * uses, and sets their defaults.
 */

/** The hyperparameters of these break models, to be tuned by play testing. */
export type BreakSettings = Readonly<{
  /** The rolling-median window for the baseline, in intervals. */
  window: number;
  /** A run's weight is `recencyDecay ** age`, age 0 being the newest run: 1 counts every run the same. */
  recencyDecay: number;
  /** The confidence required for the trust horizon, from 0 to 1. */
  level: number;
  /**
   * How many intervals' worth of weight the prior gets in the run in progress's baseline: at its start, the baseline is
   * mostly the prior, and the run's own intervals take over as they come. 0 uses no prior.
   */
  priorStrength: number;
  /** How many synthetic runs the model counts, older than all the player's. 0 counts none. */
  syntheticRuns: number;
  /**
   * The recency decay between synthetic runs, where `recencyDecay` is between the player's: with n runs of the player's,
   * synthetic run j (from 0) weighs `recencyDecay ** n * syntheticDecay ** j`.
   */
  syntheticDecay: number;
  /** The typical interval of the synthetic runs, in milliseconds. */
  priorBaseline: number;
  /** The prior mixture's share of breaks among the intervals, from 0 to 1. */
  priorBreakShare: number;
  /** How many times its baseline the prior mixture's typical break is. */
  priorBreakSize: number;
  /** The spread of the prior mixture's normal intervals around their baseline, in log-interval (0.25 is about 25%). */
  priorNormalSpread: number;
  /** The spread of the prior mixture's breaks around their typical size, in log-interval. */
  priorBreakSpread: number;
  /** How likely an interval must be a break, from 0 to 1, for the game to take it for one. */
  breakThreshold: number;
  /** The share of the runs' weight, from 0 to 1, that must break at a place for it to be a usual break spot. */
  usualThreshold: number;
  /** How many slots a group past the trust horizon starts with. */
  startingSlots: number;
}>;

/** The slider of each hyperparameter. */
export const HYPERPARAMETERS: { readonly [K in keyof BreakSettings]: Hyperparameter } = {
  window: {
    key: 'window',
    label: 'Window',
    min: 3,
    max: 61,
    step: 2,
    format: (value) => `${String(value)} intervals`,
    help: {
      what: 'Each interval (the time you took to type a digit after the one before) is compared with its baseline: the interval expected at that place without a break. The baseline is taken from the intervals around the place, over this many intervals. A break is an interval clearly longer than its baseline.',
      why: 'Along the places rather than at each place across runs, so that a break you make at the same place every time still stands out, instead of becoming the usual time there. Only around the place, because you slow down as you get into what you know less well: at 21, the baseline follows your speed over about four groups of 5.',
      moving:
        'Smaller follows changes of speed sooner, but leans on fewer intervals, so where breaks fill much of the window, they pull the baseline up and stop standing out. Larger is steadier but lags behind your slowdown, so the slow end of a run can look like breaks.',
    },
  },
  recencyDecay: {
    key: 'recencyDecay',
    label: 'Recency decay',
    min: 0.5,
    max: 1,
    step: 0.01,
    format: (value) =>
      value < 1
        ? `${value.toFixed(2)} (half weight ${(Math.log(0.5) / Math.log(value)).toFixed(1)} runs back)`
        : '1 (every run the same)',
    help: {
      what: 'How much each run counts compared with the one after it: a run’s weight is this to the power of its age, the newest run counting 1. At 0.9, the run before the newest counts 0.9, one about 7 runs back half, and one 22 runs back a tenth.',
      why: 'So that the game follows you when you regroup some digits, without one odd run flipping your groups. The weights fade smoothly, so no run suddenly drops out. They count everywhere: in telling breaks apart, in your usual break spots and in how far they’re trusted.',
      moving:
        'At 1, every run counts the same: your groups build up over all your runs, and a regrouping takes as long to show as you’ve played. Lower follows your latest runs: a regrouping shows sooner, but there’s less evidence, so the trust horizon comes sooner too.',
    },
  },
  level: {
    key: 'level',
    label: 'Level',
    min: 0,
    max: 1,
    step: 0.01,
    format: (value) => value.toFixed(2),
    help: {
      what: 'How confident the game must be of its verdict at a place, a usual break there or not, to follow your groups there. The place where it stops being that confident is the trust horizon: past it, the game stops following your groups.',
      why: 'The confidence at a place is the probability that your break rate there is on the side of ½ the verdict says, given the recency-weighted runs that reached it. It drops as fewer runs reach a place and as they disagree, but it’s noisy and would cross any level many times. So the game fits the best curve that only goes down, the confidence trend, and cuts where that falls below this level: once, so there’s a single horizon.',
      moving:
        'At 0.9, about three recent runs need to agree. Higher asks for more of them, so the trust horizon comes sooner. Lower follows your groups further, into places fewer runs agree on: at 0, everywhere your runs reach.',
    },
  },
  priorStrength: {
    key: 'priorStrength',
    label: 'Prior strength',
    min: 0,
    max: 20,
    step: 0.5,
    format: (value) => `${String(value)} intervals`,
    help: {
      what: 'Where the intervals a baseline is taken from say little, such as at the start of a run or at the places few of your runs reached, the baseline starts from a prior, and the intervals take over as they come. The prior counts as this many intervals: at 5, it weighs half against 5 intervals and a fifth against 20.',
      why: 'Without it, a baseline taken from a few intervals would be pulled up by a break among them, which would then hide, and the first interval of a run would be its own baseline, so never a break.',
      moving:
        'Higher trusts the prior longer, so breaks show from the first intervals, but a speed much unlike the prior is misjudged for longer. Lower follows the intervals’ own speed sooner. 0 is no prior at all.',
    },
  },
  syntheticRuns: {
    key: 'syntheticRuns',
    label: 'Synthetic runs',
    min: 0,
    max: 20,
    step: 1,
    format: (value) => `${String(value)} runs`,
    help: {
      what: 'How many made-up runs the game counts besides yours, older than all of them. They’re never made up digit by digit nor shown: the game adds what they would add up to. Each is typed at the prior baseline, pauses as the prior mixture below says, and breaks nowhere in particular. They count everywhere your runs do: in telling breaks apart, in your usual break spots and in how far those are trusted.',
      why: 'Before you’ve played enough, your own runs can’t say what a break looks like for you, how fast you type, or where you usually break: the synthetic runs stand in for them. Since they’re just older runs, nothing switches from them to yours: like any old run, they fade as yours come.',
      moving:
        'More makes your first runs count for less against them: breaks are judged more by the prior mixture, and your groups are trusted after more runs. Fewer lets your own runs take over sooner. 0 counts none.',
    },
  },
  syntheticDecay: {
    key: 'syntheticDecay',
    label: 'Synthetic decay',
    min: 0.05,
    max: 1,
    step: 0.05,
    format: (value) => value.toFixed(2),
    help: {
      what: 'The recency decay between synthetic runs, where the recency decay above is between yours: the newest synthetic run counts as much as a run just older than your oldest, and each one before it this much as the one after it. At 0.5, the 5 synthetic runs together count about as much as 2 of your runs would there.',
      why: 'So the synthetic runs are just older runs, fading like all of them as you play, while how much they count in all can be tuned apart from your own runs.',
      moving:
        'Higher makes them count for more, for longer; lower lets your own runs take over sooner. 1 counts each synthetic run like a run of yours.',
    },
  },
  priorBaseline: {
    key: 'priorBaseline',
    label: 'Prior baseline',
    min: 100,
    max: 1000,
    step: 10,
    format: (value) => `${String(value)} ms (${perSecond(value)} digits/s)`,
    help: {
      what: 'The typical interval of the synthetic runs: how fast the game expects you to type before your own runs say so.',
      why: 'Your first run has no earlier runs to say how fast you type, so the game needs a best guess. It mostly matters for the first digits of your first runs: your own intervals soon take over.',
      moving:
        'Higher makes the first digits’ pauses need to be longer to count as breaks; lower makes them count sooner. Set it near how fast a player types digits they know.',
    },
  },
  priorBreakShare: {
    key: 'priorBreakShare',
    label: 'Prior break share',
    min: 0.02,
    max: 0.5,
    step: 0.01,
    format: (value) => `${value.toFixed(2)} (1 in ${oneIn(value)} digits)`,
    help: {
      what: 'The share of intervals the prior mixture expects to be breaks, shown with one digit out of how many that makes. At 0.15, 1 in 6.7 digits, groups of 6 or 7 on average.',
      why: 'The mixture has two kinds of intervals, normal ones and breaks, each in some share. How likely an interval is a break depends on how common breaks are, not only on how long it is.',
      moving:
        'Higher makes shorter pauses count as breaks, so more and smaller groups at first. Lower asks for longer pauses.',
    },
  },
  priorBreakSize: {
    key: 'priorBreakSize',
    label: 'Prior break size',
    min: 1.2,
    max: 6,
    step: 0.1,
    format: (value) => `${value.toFixed(1)} × baseline`,
    help: {
      what: 'How long the prior mixture expects a typical break to be, as a multiple of the baseline: at 2.5, a break where you usually take 200 ms takes about 500 ms.',
      why: 'Breaks are relative to your speed, so their size is a ratio. Together with the spreads and the share, it sets the line between normal intervals and breaks: with the defaults, an interval over about 1.8 times its baseline counts as a break.',
      moving: 'Higher asks for longer pauses before a break counts; lower lets shorter ones count.',
    },
  },
  priorNormalSpread: {
    key: 'priorNormalSpread',
    label: 'Prior normal spread',
    min: 0.05,
    max: 0.8,
    step: 0.01,
    format: (value) =>
      `${value.toFixed(2)} (about ${String(Math.round((Math.exp(value) - 1) * 100))}%)`,
    help: {
      what: 'How much the prior mixture expects normal intervals to vary around their baseline, as the standard deviation of their logs: 0.25 is about 28% either way.',
      why: 'An interval a little longer than its baseline is normal variation; how far normal goes decides how long a break must be to stand out.',
      moving:
        'Higher takes more of the slow intervals for normal ones, so fewer breaks; lower makes slightly slow intervals count as breaks.',
    },
  },
  priorBreakSpread: {
    key: 'priorBreakSpread',
    label: 'Prior break spread',
    min: 0.05,
    max: 1.5,
    step: 0.01,
    format: (value) => value.toFixed(2),
    help: {
      what: 'How much the prior mixture expects breaks to vary around their typical size, as the standard deviation of their logs.',
      why: 'Some breaks are short hesitations, others long thinks; a wide spread lets both count as breaks.',
      moving:
        'Higher lets both short and very long pauses count as breaks. Lower expects breaks of about one size, so pauses much shorter or longer than it count less.',
    },
  },
  breakThreshold: {
    key: 'breakThreshold',
    label: 'Break threshold',
    min: 0.05,
    max: 0.95,
    step: 0.05,
    format: (value) => value.toFixed(2),
    help: {
      what: 'How likely an interval must be a break for the game to take it for one: past the trust horizon, where a group ends while you play, and the red bars on each run’s chart.',
      why: 'The mixture says how likely each interval is a break; turning that into yes or no is a separate choice, of which mistake is worse. Asking for more than ½ means a false break (a group cut where you didn’t mean it) is worse than a missed one (a group running on). At 0.8, the evidence for a break must be 4 times what ½ asks for. It moves only the decision, never the fit, so the probabilities stay honest.',
      moving:
        'Higher finds fewer breaks, so longer groups; lower finds more. Most intervals are clearly one or the other, so it mostly moves the borderline pauses.',
    },
  },
  usualThreshold: {
    key: 'usualThreshold',
    label: 'Usual threshold',
    min: 0.05,
    max: 0.95,
    step: 0.05,
    format: (value) => `${String(Math.round(value * 100))}% of runs`,
    help: {
      what: 'How likely a break must be at a place, over your runs, for it to be one of your usual break spots, which cut your groups within the trust horizon.',
      why: 'Your groups are where you usually break, and “usually” needs a line: ½ is as likely a break as not. The confidence, and so the trust horizon, measure how sure the game is that the place is on the same side of this line as its verdict.',
      moving:
        'Higher keeps only the breaks you make nearly every time, so longer groups; lower counts breaks you make now and then too, so shorter ones. Near the line, runs are split, so the confidence there is low and the horizon comes sooner.',
    },
  },
  startingSlots: {
    key: 'startingSlots',
    label: 'Starting slots',
    min: 1,
    max: 10,
    step: 1,
    format: (value) => `${String(value)} slots`,
    help: {
      what: 'How many slots a group starts with where the game doesn’t know your groups yet: past the trust horizon, and everywhere for a new player.',
      why: 'Groups of 5 are a common way to learn π, and a good default until your own show. The group still grows a slot with each digit typed past them until you pause, so it never forces a size on you.',
      moving: 'Only what the empty slots show: the group still ends where you pause.',
    },
  },
};

/** How many digits per second an interval makes: `300` ms is 3.3 digits a second. */
function perSecond(milliseconds: number): string {
  return String(Number((1000 / milliseconds).toFixed(1)));
}

/** How many digits hold one, for a share of them: `0.15` is one digit out of 6.7. */
export function oneIn(share: number): string {
  return String(Number((1 / share).toFixed(1)));
}
