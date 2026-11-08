import { Component, computed, inject, signal } from '@angular/core';
import { Tweaks } from '../../developer-mode/tweaks';
import { Vibrator } from '../../feedback/vibrator';
import {
  durationAt,
  MOST_STEPS,
  sliderOf,
  Vibration,
  VIBRATION_PATTERNS,
  VibrationPattern,
  VibrationPatterns,
  VIBRATIONS,
} from '../../feedback/vibrations';
import { Candy } from '../../ui/candy';
import { Page } from '../../ui/page';
import { Slider } from '../../ui/slider';
import { CopyValues } from './copy-values';

/** Each vibration's name, and when it plays. */
const ABOUT: Readonly<Record<Vibration, { readonly name: string; readonly when: string }>> = {
  play: { name: 'Play', when: 'Starting a game, on the main menu.' },
  button: { name: 'Button', when: 'Tapping any other button.' },
  digit: { name: 'Digit', when: 'Typing a right digit.' },
  mistake: { name: 'Mistake', when: 'Typing a wrong digit.' },
  backspace: { name: 'Backspace', when: 'Deleting a digit.' },
  pluck: { name: 'Pluck', when: 'Each digit plucking itself off its slot, as its word ends.' },
  landing: { name: 'Landing', when: 'Each digit landing on the tape.' },
  turn: {
    name: 'Turn',
    when: 'The game handing Discover’s round to the player, or taking it back to show it.',
  },
};

/** The steps of the slider, from 0 to its end. */
const SLIDER_STEPS = 1000;
/** The duration of a pause added after a buzz, in ms. */
const NEW_PAUSE = 50;

/** A step of one of the patterns. */
interface StepRef {
  readonly vibration: Vibration;
  readonly index: number;
}

/**
 * Developer mode's page to tune the vibrations: each one's pattern as its steps in order, buzzes and pauses, each
 * selected to set its duration on the one slider staying at the bottom of the screen; a step added to the end, or the last one removed; and
 * a button to try it.
 */
@Component({
  selector: 'app-vibrations',
  imports: [Candy, CopyValues, Page, Slider],
  template: `
    <app-page heading="Vibrations">
      <button pageAction type="button" appCandy="danger" [disabled]="!tuned()" (click)="resetAll()">
        Reset All
      </button>
      <div class="list">
        @for (vibration of vibrations; track vibration) {
          @let pattern = patterns()[vibration];
          <section class="panel" [attr.aria-labelledby]="vibration + '-title'">
            <div class="head">
              <h2 [id]="vibration + '-title'">{{ about[vibration].name }}</h2>
              <button
                type="button"
                class="frosted pill"
                data-vibration="none"
                [attr.aria-label]="'Try ' + about[vibration].name"
                (click)="vibrator.try(pattern)"
              >
                Try
              </button>
              <button
                type="button"
                class="round"
                title="Back to Default"
                [disabled]="isDefault(vibration)"
                (click)="reset(vibration)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 14 4 9l5-5" />
                  <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
                </svg>
              </button>
            </div>
            <p class="when">{{ about[vibration].when }}</p>
            <div class="steps" role="group" [attr.aria-label]="about[vibration].name + ' pattern'">
              @for (step of pattern; track $index; let i = $index) {
                <button
                  type="button"
                  class="step"
                  [class.pause]="i % 2 === 1"
                  [attr.aria-label]="(i % 2 === 0 ? 'Buzz ' : 'Pause ') + step + ' ms'"
                  [attr.aria-pressed]="isSelected(vibration, i)"
                  (click)="selected.set({ vibration, index: i })"
                >
                  {{ step }}
                </button>
              }
              <span class="ends">
                <button
                  type="button"
                  class="round"
                  title="Remove the Last Step"
                  [disabled]="pattern.length <= 1"
                  (click)="removeStep(vibration)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
                </button>
                <button
                  type="button"
                  class="round"
                  title="Add a Step"
                  [disabled]="pattern.length >= mostSteps"
                  (click)="addStep(vibration)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg>
                </button>
              </span>
            </div>
          </section>
        }
        <app-copy-values [values]="{ vibrations: patterns() }" />
      </div>
      <app-slider
        class="slider panel"
        [label]="selectedName()"
        [value]="sliderValue()"
        [min]="0"
        [max]="sliderSteps"
        [valueText]="selectedDuration() + ' ms'"
        (changed)="slide($event)"
      />
    </app-page>
  `,
  styleUrl: './vibrations.css',
})
export class Vibrations {
  protected readonly vibrations = VIBRATIONS;
  protected readonly about = ABOUT;
  protected readonly mostSteps = MOST_STEPS;
  protected readonly sliderSteps = SLIDER_STEPS;
  protected readonly vibrator = inject(Vibrator);
  private readonly tweaks = inject(Tweaks);

  /** The patterns being tuned. */
  protected readonly patterns = signal<VibrationPatterns>(this.storedPatterns());
  /** The step whose duration is on the slider. */
  protected readonly selected = signal<StepRef>({ vibration: VIBRATIONS[0], index: 0 });

  protected readonly tuned = computed(() =>
    VIBRATIONS.some((vibration) => !this.isDefault(vibration)),
  );
  protected readonly selectedDuration = computed(() => {
    const { vibration, index } = this.selected();
    return this.patterns()[vibration][index] ?? 0;
  });
  protected readonly selectedName = computed(() => {
    const { vibration, index } = this.selected();
    return `${ABOUT[vibration].name}, ${index % 2 === 0 ? 'buzz' : 'pause'} ${String(Math.floor(index / 2) + 1)}`;
  });
  protected readonly sliderValue = computed(() =>
    Math.round(sliderOf(this.selectedDuration()) * SLIDER_STEPS),
  );

  protected isDefault(vibration: Vibration): boolean {
    const pattern = this.patterns()[vibration];
    const own = VIBRATION_PATTERNS[vibration];
    return pattern.length === own.length && pattern.every((step, i) => step === own[i]);
  }

  protected isSelected(vibration: Vibration, index: number): boolean {
    const selected = this.selected();
    return selected.vibration === vibration && selected.index === index;
  }

  /** Sets the selected step's duration from the slider. */
  protected slide(position: number): void {
    const { vibration, index } = this.selected();
    const duration = durationAt(position / SLIDER_STEPS);
    this.tune(
      vibration,
      this.patterns()[vibration].map((step, i) => (i === index ? duration : step)),
    );
  }

  /** Adds a step to the end of a pattern, and selects it: a pause after a buzz, and a buzz like the last after a pause. */
  protected addStep(vibration: Vibration): void {
    const pattern = this.patterns()[vibration];
    const added = pattern.length % 2 === 1 ? NEW_PAUSE : (pattern.at(-2) ?? 0);
    this.tune(vibration, [...pattern, added]);
    this.selected.set({ vibration, index: pattern.length });
  }

  /** Removes the last step of a pattern, selecting the one before it if it was selected. */
  protected removeStep(vibration: Vibration): void {
    const pattern = this.patterns()[vibration];
    this.tune(vibration, pattern.slice(0, -1));
    this.keepSelection(vibration);
  }

  /** Brings back the game's own pattern of a vibration. */
  protected reset(vibration: Vibration): void {
    this.patterns.update((patterns) => ({
      ...patterns,
      [vibration]: VIBRATION_PATTERNS[vibration],
    }));
    this.keepSelection(vibration);
    void this.tweaks.setVibration(vibration, undefined);
  }

  protected resetAll(): void {
    for (const vibration of VIBRATIONS) {
      this.reset(vibration);
    }
  }

  private tune(vibration: Vibration, pattern: VibrationPattern): void {
    this.patterns.update((patterns) => ({ ...patterns, [vibration]: pattern }));
    void this.tweaks.setVibration(vibration, pattern);
  }

  /** Moves the selection onto the last step of a pattern, if it was past it. */
  private keepSelection(vibration: Vibration): void {
    const { vibration: selected, index } = this.selected();
    const last = this.patterns()[vibration].length - 1;
    if (selected === vibration && index > last) {
      this.selected.set({ vibration, index: last });
    }
  }

  /** The patterns as tuned. */
  private storedPatterns(): VibrationPatterns {
    return { ...VIBRATION_PATTERNS, ...this.tweaks.values().vibrations };
  }
}
