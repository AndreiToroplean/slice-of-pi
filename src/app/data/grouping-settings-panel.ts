import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { CopyValues } from '../developer/copy-values';
import { groupingText, Tweaks } from '../developer/tweaks';
import { BreakSettings, DEFAULT_BREAK_SETTINGS } from '../timing/break-model';

/** A slider for one hyperparameter of the break model, with what it means behind a help button. */
interface Control {
  readonly key: keyof BreakSettings;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly format: (value: number) => string;
  readonly help: { readonly what: string; readonly why: string; readonly moving: string };
}

export const CONTROLS: readonly Control[] = [
  {
    key: 'window',
    label: 'Window',
    min: 3,
    max: 61,
    step: 2,
    format: (value) => `${String(value)} intervals`,
    help: {
      what: 'Each interval (the time you took to type a digit after the one before) is compared with its baseline: the interval expected at that place without a break. The baseline is the median of the intervals around it, over this many intervals. In the run being played, only those typed so far count. A break is an interval clearly longer than its baseline.',
      why: 'A median, because breaks are a minority of the intervals: unlike an average, it isn’t pulled up by them. Along each run rather than across runs at the same place, so that a break you make at the same place every time still stands out, instead of becoming the usual time there. Rolling, because you slow down as you get into what you know less well: at 21, the baseline follows your speed over about four groups of 5.',
      moving:
        'Smaller follows changes of speed sooner, but where breaks fill nearly half the window, the median rises with them and they stop standing out. Larger is steadier but lags behind your slowdown, so the slow end of a run can look like breaks.',
    },
  },
  {
    key: 'recencyDecay',
    label: 'Recency decay',
    min: 0.5,
    max: 1,
    step: 0.01,
    format: (value) =>
      value < 1
        ? `${value.toFixed(2)}, half weight ${(Math.log(0.5) / Math.log(value)).toFixed(1)} runs back`
        : '1, every run the same',
    help: {
      what: 'How much each run counts compared with the one after it: a run’s weight is this to the power of its age, the newest run counting 1. At 0.9, the run before the newest counts 0.9, one about 7 runs back half, and one 22 runs back a tenth.',
      why: 'So that the game follows you when you regroup some digits, without one odd run flipping your groups. The weights fade smoothly, so no run suddenly drops out. They count everywhere: in telling breaks apart, in your usual break spots and in how far they’re trusted.',
      moving:
        'At 1, every run counts the same: your groups build up over all your runs, and a regrouping takes as long to show as you’ve played. Lower follows your latest runs: a regrouping shows sooner, but there’s less evidence, so the trust horizon comes sooner too.',
    },
  },
  {
    key: 'level',
    label: 'Level',
    min: 0.5,
    max: 0.99,
    step: 0.01,
    format: (value) => value.toFixed(2),
    help: {
      what: 'How confident the game must be of its verdict at a place, a usual break there or not, to follow your groups there. The place where it stops being that confident is the trust horizon: past it, the game stops following your groups.',
      why: 'The confidence at a place is the probability that your break rate there is on the side of ½ the verdict says, given the recency-weighted runs that reached it. It drops as fewer runs reach a place and as they disagree, but it’s noisy and would cross any level many times. So the game fits the best curve that only goes down, the confidence trend, and cuts where that falls below this level: once, so there’s a single horizon.',
      moving:
        'At 0.9, about three recent runs need to agree. Higher asks for more of them, so the trust horizon comes sooner. Lower follows your groups further, into places fewer runs agree on.',
    },
  },
  {
    key: 'priorStrength',
    label: 'Prior strength',
    min: 0,
    max: 20,
    step: 0.5,
    format: (value) => `${String(value)} intervals`,
    help: {
      what: 'At the start of a run, its own few intervals say little about its speed, so its baseline starts from a prior, what earlier runs say, and the run’s own intervals take over as they come. The prior counts as this many intervals: at 5, it weighs half after 5 intervals and a fifth after 20.',
      why: 'Without it, the first interval of a run would be its own baseline, so never a break, and a break among the next few would pull the baseline up towards itself and hide. The prior is how much faster or slower than the speed curve your earlier runs were, synthetic ones included, recent ones weighing more.',
      moving:
        'Higher trusts your usual speed longer, so breaks show from the first digit, but a run much faster or slower than usual is misjudged for longer. Lower follows each run’s own speed sooner. 0 is no prior at all.',
    },
  },
  {
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
  {
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
  {
    key: 'priorBaseline',
    label: 'Prior baseline',
    min: 100,
    max: 1000,
    step: 10,
    format: (value) => `${String(value)} ms`,
    help: {
      what: 'The typical interval of the synthetic runs: how fast the game expects you to type before your own runs say so.',
      why: 'Your first run has no earlier runs to say how fast you type, so the game needs a best guess. It mostly matters for the first digits of your first runs: your own intervals soon take over.',
      moving:
        'Higher makes the first digits’ pauses need to be longer to count as breaks; lower makes them count sooner. Set it near how fast a player types digits they know.',
    },
  },
  {
    key: 'priorBreakShare',
    label: 'Prior break share',
    min: 0.02,
    max: 0.5,
    step: 0.01,
    format: (value) => `${String(Math.round(value * 100))}% of intervals`,
    help: {
      what: 'The share of intervals the prior mixture expects to be breaks. At 15%, about one interval in 7: groups of 6 or 7 on average.',
      why: 'The mixture has two kinds of intervals, normal ones and breaks, each in some share. How likely an interval is a break depends on how common breaks are, not only on how long it is.',
      moving:
        'Higher makes shorter pauses count as breaks, so more and smaller groups at first. Lower asks for longer pauses.',
    },
  },
  {
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
  {
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
  {
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
  {
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
  {
    key: 'usualThreshold',
    label: 'Usual threshold',
    min: 0.05,
    max: 0.95,
    step: 0.05,
    format: (value) => `${String(Math.round(value * 100))}% of runs`,
    help: {
      what: 'How much of your runs’ weight must break at a place for it to be one of your usual break spots, which cut your groups within the trust horizon.',
      why: 'Your groups are where you usually break, and “usually” needs a line: ½ is a majority of your recent runs. The confidence, and so the trust horizon, measure how sure the game is that your break rate is on the same side of this line as its verdict.',
      moving:
        'Higher keeps only the breaks you make nearly every time, so longer groups; lower counts breaks you make now and then too, so shorter ones. Near the line, runs are split, so the confidence there is low and the horizon comes sooner.',
    },
  },
  {
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
];

/**
 * Developer mode's sliders for every hyperparameter of the break model, each with a button bringing back the game's value and a
 * help button opening a dialog that says what it does, a button to bring back the game's settings, and one to copy their values so they go into the code.
 * Content given to it goes above the sliders.
 */
@Component({
  selector: 'app-grouping-settings-panel',
  imports: [CopyValues],
  template: `
    <div class="heading">
      <h2 id="grouping-settings-title">Grouping settings</h2>
      <button type="button" class="frosted pill" [disabled]="!tuned()" (click)="reset()">
        Back to the game's settings
      </button>
    </div>
    <p>How your groups are found. The charts below follow as you move them.</p>
    <ng-content />
    @for (control of controls; track control.key) {
      <div class="setting">
        <div class="top">
          <label [for]="'setting-' + control.key">{{ control.label }}</label>
          <output [for]="'setting-' + control.key">{{ formatted(control) }}</output>
          <button
            type="button"
            class="round"
            [attr.aria-label]="revertLabel(control)"
            [disabled]="isDefault(control)"
            (click)="revert(control)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
          </button>
          <button
            type="button"
            class="round"
            aria-haspopup="dialog"
            [attr.aria-label]="'About ' + control.label"
            (click)="showHelp(control)"
          >
            ?
          </button>
        </div>
        <input
          type="range"
          [id]="'setting-' + control.key"
          [min]="control.min"
          [max]="control.max"
          [step]="control.step"
          [value]="position(control)"
          [attr.aria-valuetext]="formatted(control)"
          (input)="set(control, $event)"
        />
      </div>
    }
    <app-copy-values [text]="copyText()" />
    <dialog #helpDialog class="card" aria-labelledby="help-title" (close)="helped.set(undefined)">
      @if (helped(); as control) {
        <h2 id="help-title">{{ control.label }}</h2>
        <div class="explanation">
          <p><b>What it is.</b> {{ control.help.what }}</p>
          <p><b>Why this way.</b> {{ control.help.why }}</p>
          <p><b>Moving it.</b> {{ control.help.moving }}</p>
        </div>
        <button type="button" class="candy" autofocus (click)="closeHelp()">Close</button>
      }
    </dialog>
  `,
  host: { class: 'panel', role: 'region', 'aria-labelledby': 'grouping-settings-title' },
  styles: `
    .heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .top {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    h2 {
      margin: 0;
      font-family: var(--font-digits);
      font-size: 1.375rem;
      font-weight: 600;
      text-shadow: var(--text-shadow);
    }

    p {
      margin: 0;
      line-height: 1.45;
      text-shadow: var(--text-shadow);
    }

    .setting {
      display: grid;
      gap: 0.125rem;
    }

    label {
      flex: 1;
      font-weight: 500;
      text-shadow: var(--text-shadow);
    }

    output {
      font-variant-numeric: tabular-nums;
      text-shadow: var(--text-shadow);
    }

    .round {
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: var(--frost-pressed);
      color: inherit;
      font: inherit;
      font-weight: 600;
    }

    .round:disabled {
      opacity: 0.4;
    }

    .round svg {
      width: 1rem;
      height: 1rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .round:focus-visible {
      outline: 0.1875rem solid var(--focus-ring);
      outline-offset: 0.125rem;
    }

    input[type='range'] {
      width: 100%;
      margin: 0;
      accent-color: var(--candy);
    }

    /* Wider than other dialogs, for its text, which scrolls if it doesn't fit. */
    dialog {
      width: min(100% - 2rem, 26rem);
      max-height: calc(100% - 4rem);
      grid-template-rows: auto minmax(0, 1fr) auto;
    }

    .explanation {
      display: grid;
      align-content: start;
      gap: 0.5rem;
      overflow-y: auto;
      font-size: 0.9375rem;
    }
  `,
})
export class GroupingSettingsPanel {
  protected readonly controls = CONTROLS;
  /** The setting whose help is open, if any. */
  protected readonly helped = signal<Control | undefined>(undefined);
  private readonly helpDialog = viewChild.required<ElementRef<HTMLDialogElement>>('helpDialog');

  private readonly tweaks = inject(Tweaks);
  private readonly settings = this.tweaks.grouping;
  /** The settings as text, to hand back so they go into the code. */
  protected readonly copyText = computed(() => groupingText(this.settings()));
  protected readonly tuned = computed(() => this.tweaks.values().grouping !== undefined);

  protected formatted(control: Control): string {
    return control.format(this.settings()[control.key]);
  }

  protected position(control: Control): number {
    return this.settings()[control.key];
  }

  protected revertLabel(control: Control): string {
    return `Back to the game's ${control.label.toLowerCase()}`;
  }

  protected isDefault(control: Control): boolean {
    return this.settings()[control.key] === DEFAULT_BREAK_SETTINGS[control.key];
  }

  protected set(control: Control, event: Event): void {
    this.apply(control, Number((event.target as HTMLInputElement).value));
  }

  /** Brings back the game's value of one setting. */
  protected revert(control: Control): void {
    this.apply(control, DEFAULT_BREAK_SETTINGS[control.key]);
  }

  private apply(control: Control, value: number): void {
    const settings = { ...this.settings(), [control.key]: value };
    const tuned = CONTROLS.some(({ key }) => settings[key] !== DEFAULT_BREAK_SETTINGS[key]);
    void this.tweaks.setGrouping(tuned ? settings : undefined);
  }

  protected showHelp(control: Control): void {
    this.helped.set(control);
    this.helpDialog().nativeElement.showModal();
  }

  protected closeHelp(): void {
    this.helpDialog().nativeElement.close();
  }

  protected reset(): void {
    void this.tweaks.setGrouping(undefined);
  }
}
