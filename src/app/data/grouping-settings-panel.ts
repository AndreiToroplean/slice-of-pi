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
];

/**
 * Developer mode's sliders for every hyperparameter of the break model, each with a help button opening a dialog that says
 * what it does, a button to bring back the game's settings, and one to copy their values so they go into the code.
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
            class="help"
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

    .help {
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

    .help:focus-visible {
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

  protected set(control: Control, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
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
