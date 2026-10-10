import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { CopyValues } from '../developer/copy-values';
import { groupingText, Tweaks } from '../developer/tweaks';
import { DEFAULT_TIMING_SETTINGS, TimingSettings } from '../timing/timing-model';

/** A slider for one setting of the timing model, with what it means behind a help button. */
interface Control {
  readonly key: keyof TimingSettings;
  readonly label: string;
  /** The slider's range and step, in its own units (see {@link toSlider}). */
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly format: (value: number) => string;
  /** From the setting's value to the slider's position and back, where the slider isn't linear. */
  readonly toSlider?: (value: number) => number;
  readonly fromSlider?: (position: number) => number;
  readonly help: { readonly what: string; readonly why: string; readonly moving: string };
}

export const CONTROLS: readonly Control[] = [
  {
    key: 'neighborhood',
    label: 'Neighborhood',
    min: 1,
    max: 12,
    step: 0.5,
    format: (value) => `${String(value)} digits`,
    help: {
      what: 'To tell a pause, each digit’s time is compared with the usual time around it, the local pace: an average of its neighbors’ times. This is how far the neighbors reach.',
      why: 'Only neighbors, because you slow down towards the end of what you know: against the whole run’s average, that slow end would look like pauses everywhere. The neighbors’ weights fade along a bell curve, so the pace glides instead of jumping as digits come in and out of reach; at 4 it amounts to about 9 neighbors. The digit being judged is left out, so a pause never raises its own bar.',
      moving:
        'Lower follows your pace closely, but only 2 or 3 neighbors decide, so one pause nearby swings it and the groups get erratic. Higher is steadier but slow to follow your slowdown: fewer breaks where you’re fast, more and smaller groups where you slow down.',
    },
  },
  {
    key: 'pauseMargin',
    label: 'Pause margin',
    min: 0.1,
    max: 2.5,
    step: 0.05,
    format: (value) => `${value.toFixed(2)} spreads`,
    help: {
      what: 'Besides the pace, the model measures how much the neighbors’ times vary around it: their spread (standard deviation). A time is a pause when it’s longer than the pace plus this many spreads.',
      why: 'How surprising a delay is depends on how irregular you are there: 300 ms is a big surprise if you always take 200 ± 10, and nothing if you swing between 100 and 400. The standard deviation is that typical swing, in milliseconds like the times, so it adds to the pace (the variance is the same thing squared, in ms²).',
      moving:
        'Higher finds fewer breaks, so bigger groups: groups split by short pauses merge. Lower finds more breaks and smaller groups, false ones from a single slow keystroke included. The spread counts your other pauses too, so where you pause every 3 digits, 0.8 already asks for about 2.5 times your typing time.',
    },
  },
  {
    key: 'minimumPause',
    label: 'Minimum pause',
    min: 1,
    max: 3,
    step: 0.05,
    format: (value) => `${value.toFixed(2)} × pace`,
    help: {
      what: 'Whatever the spread says, a pause must also be at least this many times the pace.',
      why: 'Where you type steadily, the spread is tiny, so the pace plus the margin is barely above the pace, and any slightly slow keystroke would be a break. It’s a ratio rather than milliseconds because an extra 50 ms is a lot for a fast player and nothing for a slow one.',
      moving:
        'Higher keeps steady stretches as one long group, and drops short pauses everywhere once it’s above the pace plus the margin. Lower lets noise cut up steady stretches. It decides where you type steadily, and the margin where you pause regularly.',
    },
  },
  {
    key: 'fullTrustUnevenness',
    label: 'Unevenness for full trust',
    min: 0.1,
    max: 1.5,
    step: 0.05,
    format: (value) => value.toFixed(2),
    help: {
      what: 'Each run’s verdict at a place, break or not, counts in the vote with a trust from 0 to 1. It grows with how uneven the run’s rhythm is there: the spread divided by the pace. At this unevenness, the run is fully trusted.',
      why: 'Divided by the pace so that it measures rhythm, not speed: a player twice as fast with the same rhythm has half the spread in milliseconds. 0.1 means times vary by about 10% (a metronome), 0.6 by 60% (clear pauses). Where you type like a metronome, a break is just noise, and a steady run says little about your groups: once you’re fluent enough to type a stretch in one stream, its groups are kept rather than erased.',
      moving:
        'Lower trusts runs sooner, so the hint follows you in more places, noisier ones included, and smooth runs erase groups sooner. Higher only trusts clearly structured stretches, so more places fall back to 5. It never moves a run’s own breaks.',
    },
  },
  {
    key: 'halfLife',
    label: 'Half-life',
    min: 0,
    max: 8,
    step: 0.25,
    format: (value) => `${value < 10 ? value.toFixed(1) : value.toFixed(0)} runs`,
    toSlider: (value) => Math.log2(value),
    fromSlider: (position) => 2 ** position,
    help: {
      what: 'How many runs back a run’s vote weighs half as much as the newest run’s. At 16, a run 16 runs old counts half, and one 32 runs old a quarter.',
      why: 'The weights fade smoothly, run after run, so no run suddenly drops out and flips a group. The slider goes from 1 to 256 runs, each step multiplying the half-life, since what matters is its order of magnitude.',
      moving:
        'Shorter makes your groups follow your last few runs: a regrouping shows quickly, but one odd run can flip groups. Longer makes them build up over many runs and stay stable, but a regrouping takes longer to show.',
    },
  },
  {
    key: 'evidenceNeeded',
    label: 'Evidence needed',
    min: 0.2,
    max: 4,
    step: 0.1,
    format: (value) => `${value.toFixed(1)} runs`,
    help: {
      what: 'At each place, the confidence of all runs together is agreement × evidence. Agreement is 1 when all the weighted votes agree, and 0 at a 50/50 split. Evidence counts the trusted votes, in fully trusted new runs: it reaches 63% at this amount, 86% at twice it and 95% at three times.',
      why: 'Multiplied because both are needed: one run agreeing with itself is unanimous but thin, and many runs split evenly are plenty of evidence but no answer. Each extra run helps less and less, and the confidence never goes past 1.',
      moving:
        'Lower makes a single run strong evidence, so the hint follows a new player right away. Higher waits for several runs that agree, so there are more 5s at first.',
    },
  },
  {
    key: 'hintConfidence',
    label: 'Confidence for the hint',
    min: 0,
    max: 1,
    step: 0.05,
    format: (value) => value.toFixed(2),
    help: {
      what: 'A group sets the hint (the number of empty slots) only if its confidence, averaged over its places, is at least this. Elsewhere, the hint is the default of 5.',
      why: 'So that the game only follows groups it has seen clearly, and offers groups of 5 meanwhile.',
      moving:
        'Lower makes the hint follow you sooner, in shakier places. Higher keeps more 5s. It never moves the groups, only whether the hint follows them: those it doesn’t are dotted.',
    },
  },
];

/**
 * Developer mode's sliders for every setting of the timing model, each with a help button opening a dialog that says
 * what it does, a button to bring back the game's settings, and one to copy their values so they go into the code.
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

    input {
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
    const value = this.settings()[control.key];
    return control.toSlider?.(value) ?? value;
  }

  protected set(control: Control, event: Event): void {
    const position = Number((event.target as HTMLInputElement).value);
    const value = control.fromSlider?.(position) ?? position;
    const settings = { ...this.settings(), [control.key]: value };
    const tuned = CONTROLS.some(({ key }) => settings[key] !== DEFAULT_TIMING_SETTINGS[key]);
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
