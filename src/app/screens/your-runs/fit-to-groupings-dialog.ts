import { Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { Tweaks } from '../../developer-mode/tweaks';
import { RunStore } from '../../player-data/run-store';
import { DropdownMenu } from '../../ui/dropdown-menu';
import type { BreakModelKind, Settings } from '../../game/grouping/break-models/break-model';
import { BREAK_MODELS } from '../../game/grouping/break-models/break-models';
import {
  fitToGroupings,
  labelsOf,
  Progress,
  Score,
  scoreGroups,
} from '../../game/grouping/break-models/fit-to-groupings';
import {
  firstMistake,
  groupsIn,
  loadMyGroupings,
  onlyDigitsAndSpaces,
  saveMyGroupings,
} from './my-groupings';

/** How long the search runs before letting the page draw, in milliseconds. */
const FRAME = 30;

/**
 * Developer mode's dialog that fits a break model's hyperparameters to the player's own groups, opened from the overflow
 * menu of Your Runs: pick the model, type or paste the groups, a space between each, and fit. Groups that aren't π show
 * as an error, saying where. The search runs while the dialog stays open, showing how well the model matches the groups
 * as an F1 score, which tells models apart on the same groups; then the dialog closes, the sliders set to the best
 * values found. Closing the dialog sooner stops the search.
 */
@Component({
  selector: 'app-fit-to-groupings-dialog',
  imports: [DropdownMenu],
  template: `
    <!-- The dialog itself takes the focus as it opens, so that no field shows a focus ring or opens the keyboard. -->
    <dialog #dialog class="card" aria-labelledby="fit-title" autofocus (close)="stop()">
      <h2 id="fit-title">Fit to My Groupings</h2>
      <div class="field">
        <span id="fit-model">Break model</span>
        <button
          type="button"
          class="frosted pill picker"
          aria-haspopup="true"
          aria-labelledby="fit-model fit-model-name"
          [disabled]="progress() !== undefined"
          (click)="modelMenu.openAt(under($event))"
        >
          <span id="fit-model-name">{{ kind().label }}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <app-dropdown-menu #modelMenu label="Break model" [button]="false">
          @for (each of models; track each.id) {
            <button type="button" class="model" [disabled]="each === kind()" (click)="pick(each)">
              {{ each.label }}{{ each === kind() ? ' Is Selected' : '' }}
              <small>{{ each.description }}</small>
            </button>
          }
        </app-dropdown-menu>
      </div>
      <label class="field">
        My groupings, a space between groups
        <textarea
          rows="6"
          spellcheck="false"
          autocomplete="off"
          aria-describedby="fit-status"
          [value]="text()"
          [disabled]="progress() !== undefined"
          [attr.aria-invalid]="mistake() !== undefined"
          (input)="type($event)"
        ></textarea>
      </label>
      <!-- Kept in its place while idle, so the dialog doesn't change size as a fit starts and ends. -->
      <progress
        max="1"
        [value]="progress()?.done ?? 0"
        [style.visibility]="progress() === undefined ? 'hidden' : null"
        aria-label="How far the fit has gone"
      ></progress>
      <p id="fit-status" class="status" role="status" [class.error]="mistake() !== undefined">
        @if (mistake(); as wrong) {
          At place {{ wrong.place }}, π goes {{ wrong.before.length < wrong.place - 1 ? '…' : ''
          }}{{ wrong.before }}<u>{{ wrong.expected }}</u
          >.
        } @else {
          {{ status() }}
        }
      </p>
      <div class="buttons">
        <button type="button" class="candy" (click)="close()">Close</button>
        <button
          type="button"
          class="candy primary"
          [disabled]="!ready() || progress() !== undefined"
          (click)="void fit()"
        >
          Fit
        </button>
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      width: min(100% - 2rem, 26rem);
    }

    .field {
      display: grid;
      gap: 0.375rem;
      font-weight: 500;
      text-shadow: var(--text-shadow);
    }

    .picker {
      justify-self: start;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .picker svg {
      width: 1rem;
      height: 1rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* Each model with what it does under its name; the one picked, readable but set apart. */
    .model {
      display: grid;
    }

    .model:disabled {
      opacity: 0.75;
    }

    .model small {
      font-size: 0.75rem;
      font-weight: 400;
      opacity: 0.85;
    }

    u {
      text-decoration-thickness: 0.125rem;
      text-underline-offset: 0.2em;
    }

    dialog:focus {
      outline: none;
    }

    textarea {
      box-sizing: border-box;
      width: 100%;
      margin: 0;
      padding: 0.5rem 0.75rem;
      border: 0.125rem solid transparent;
      border-radius: 0.75rem;
      background: var(--candy);
      color: var(--on-candy);
      font-family: var(--font-digits);
      font-size: 1rem;
      font-weight: 500;
      line-height: 1.4;
      resize: vertical;
      /* Its caret shows it has the focus, and its border whether it's valid. */
      outline: none;
    }

    textarea[aria-invalid='true'] {
      border-color: var(--candy-danger);
    }

    /* On a touch screen, no focus rings: what's tapped is plain to see. */
    @media (pointer: coarse) {
      :focus-visible {
        outline: none;
      }
    }

    progress {
      width: 100%;
      accent-color: var(--candy);
    }

    .status {
      margin: 0;
      min-height: 2.9em;
      line-height: 1.45;
      font-variant-numeric: tabular-nums;
      text-shadow: var(--text-shadow);
    }

    .status.error {
      color: var(--candy-danger);
      font-weight: 600;
      text-shadow: none;
    }

    .buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-2);
    }
  `,
})
export class FitToGroupingsDialog {
  /** The times of the runs the groups come from, oldest first. */
  readonly runs = input.required<readonly (readonly number[])[]>();

  protected readonly models = BREAK_MODELS;
  private readonly tweaks = inject(Tweaks);
  private readonly store = inject(RunStore);
  protected readonly kind = this.tweaks.breakModelKind;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** The groupings as typed. */
  protected readonly text = signal('');
  private readonly groups = computed(() => groupsIn(this.text()));
  protected readonly mistake = computed(() => firstMistake(this.groups()));
  private readonly labels = computed(() => labelsOf(this.groups().map((group) => group.length)));
  /** Whether there are groups to fit to, all of π, and runs to fit with. */
  protected readonly ready = computed(
    () => this.groups().length > 0 && this.mistake() === undefined && this.runs().length > 0,
  );
  /** How well the model, as set now, matches the groups. */
  private readonly current = computed(() =>
    this.ready()
      ? scoreGroups(this.tweaks.breakModel().stats(this.runs()).groups, this.labels())
      : undefined,
  );
  /** How far the search has gone, while it runs. */
  protected readonly progress = signal<Progress | undefined>(undefined);
  private abort: AbortController | undefined;

  protected readonly status = computed(() => {
    if (this.mistake() !== undefined) {
      return '';
    }
    if (this.groups().length === 0) {
      return 'Type or paste the decimals of π as you group them.';
    }
    if (this.runs().length === 0) {
      return 'No runs to fit to.';
    }
    const running = this.progress();
    if (running !== undefined) {
      const stage =
        running.stage === 'yours'
          ? `Refining your values until they settle, pass ${String(running.pass)}`
          : running.stage === 'drawing'
            ? `Trying ${String(running.draws)} random draws`
            : `Refining pick ${String(running.pick)} of ${String(running.picks)} until it settles, pass ${String(running.pass)}`;
      return `${stage}: best F1 ${f1(running.best.score)} so far.`;
    }
    const current = this.current();
    return current === undefined ? '' : `Now: F1 ${f1(current)}. ${details(current)}`;
  });

  /** Opens the dialog, with the groupings typed last. */
  async open(): Promise<void> {
    this.text.set(await loadMyGroupings(this.store));
    this.dialog().nativeElement.showModal();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  /** Stops the search, if it runs, leaving the hyperparameters as they were. */
  protected stop(): void {
    this.abort?.abort();
  }

  protected pick(kind: BreakModelKind): void {
    void this.tweaks.setBreakModel(kind);
  }

  /** Where the menu of models opens: under the button pressed, in window coordinates. */
  protected under(event: Event): { readonly x: number; readonly y: number } {
    const button = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: button.left + button.width / 2, y: button.bottom };
  }

  /** Takes what's typed, keeping only digits and spaces. */
  protected type(event: Event): void {
    const field = event.target as HTMLTextAreaElement;
    const text = onlyDigitsAndSpaces(field.value);
    if (text !== field.value) {
      field.value = text;
    }
    this.text.set(text);
    void saveMyGroupings(this.store, text);
  }

  /** Fits the model picked to the groups, sets its sliders to the best values found, and closes the dialog. */
  protected async fit(): Promise<void> {
    const kind = this.kind();
    const ready = this.ready();
    const abort = new AbortController();
    this.abort = abort;
    let paused = performance.now();
    const best = await fitToGroupings(kind, this.tweaks.grouping(), this.runs(), this.labels(), {
      signal: abort.signal,
      pause: async (progress) => {
        this.progress.set(progress);
        if (performance.now() - paused > FRAME) {
          await new Promise((resolve) => setTimeout(resolve));
          paused = performance.now();
        }
      },
    });
    this.progress.set(undefined);
    if (abort.signal.aborted || !ready) {
      return;
    }
    await this.tweaks.setGrouping(tunedOnly(kind, best.settings));
    this.close();
  }
}

/** The settings, or `undefined` if they're all the model's defaults. */
function tunedOnly(kind: BreakModelKind, settings: Settings): Settings | undefined {
  return Object.keys(kind.defaults).some((key) => settings[key] !== kind.defaults[key])
    ? settings
    : undefined;
}

function f1(score: Score): string {
  return score.f1.toFixed(2);
}

/** The breaks matched, of all those of the groups, and the extra ones. */
function details({ matched, missed, extra }: Score): string {
  return `${String(matched)} of ${String(matched + missed)} breaks matched, ${String(extra)} extra.`;
}
