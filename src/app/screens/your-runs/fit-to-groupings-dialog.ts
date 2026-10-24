import { Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { Tweaks } from '../../developer-mode/tweaks';
import { DropdownMenu } from '../../ui/dropdown-menu';
import type { Plot } from './views/plot';
import { PlotChart } from './views/plot-chart';
import type { BreakModelKind, Settings } from '../../game/grouping/break-models/break-model';
import { BREAK_MODELS } from '../../game/grouping/break-models/break-models';
import {
  fitToGroupings,
  labelsOf,
  Progress,
  runCountCurve,
  Score,
  scoreGroups,
} from '../../game/grouping/break-models/fit-to-groupings';
import { MyGroupings } from './my-groupings';

/** How long the search runs before letting the page draw, in milliseconds. */
const FRAME = 30;

/**
 * Developer mode's dialog that fits a break model's hyperparameters to the player's own groups, opened from the overflow
 * menu of Your Runs: pick the model and fit it to the groups typed in the Group tab of Your Runs. Groups that aren't π
 * show as an error, saying where. The search, which leaves the hyperparameters pinned on Your Runs where they are, runs while the dialog stays open, showing how well the model matches the groups
 * as an F1 score, which tells models apart on the same groups, with all the runs or, fitting the run-count curve, with
 * fewer too; then the sliders are set to the best values found. It
 * stays open, so as to fit again once the model or the groups change. It draws the run-count curve of the model as set,
 * to tell how well it holds up with fewer runs, as it opens and again after each fit. Closing the dialog stops the
 * search, and the curve.
 */
@Component({
  selector: 'app-fit-to-groupings-dialog',
  imports: [DropdownMenu, PlotChart],
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
          [disabled]="locked()"
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
      @if (curveKind(); as shown) {
        <section
          class="curve"
          aria-labelledby="fit-curve-title"
          [attr.aria-busy]="curving() !== undefined"
        >
          <h3 id="fit-curve-title">Run-count curve of {{ shown.label }}</h3>
          <div class="chart">
            @if (curvePlot(); as plot) {
              <app-plot-chart [plot]="plot" [class.stale]="curving() !== undefined" />
            }
            @if (curving() !== undefined) {
              <span class="spinner" role="img" aria-label="Drawing the curve"></span>
            }
          </div>
          @if (curvePlot(); as plot) {
            <p class="axis" aria-hidden="true">
              <span>{{ plot.x.labels[0] }}</span
              ><span>{{ plot.x.labels[1] }}</span>
            </p>
            <p class="caption">{{ plot.caption }}</p>
          }
        </section>
      }
      <div class="buttons">
        <button type="button" class="candy" (click)="close()">Close</button>
        <button
          type="button"
          class="candy end-fit"
          [disabled]="!ready() || locked() || fitted() === 'end'"
          (click)="void fit(false)"
        >
          {{ fitted() === 'end' ? 'Fitted' : 'Fit' }}
        </button>
        <button
          type="button"
          class="candy primary curve-fit"
          [disabled]="!ready() || locked() || fitted() === 'curve'"
          (click)="void fit(true)"
        >
          {{ fitted() === 'curve' ? 'Curve Fitted' : 'Fit Curve' }}
        </button>
      </div>
    </dialog>
  `,
  styles: `
    /* Only its dialog, over the page: no place of its own where it's put. */
    :host {
      display: contents;
    }

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

    .curve {
      display: grid;
      gap: 0.25rem;
      text-shadow: var(--text-shadow);
    }

    .curve h3 {
      margin: 0;
      font-size: 1rem;
    }

    .curve p {
      margin: 0;
    }

    .chart {
      position: relative;
      height: 4rem;
    }

    .stale {
      opacity: 0.35;
    }

    /* A ring with a gap, turning while the curve is drawn. */
    .spinner {
      position: absolute;
      inset: 0;
      width: 1.5rem;
      height: 1.5rem;
      margin: auto;
      box-sizing: border-box;
      border: 0.1875rem solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(1turn);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation-duration: 3s;
      }
    }

    .axis {
      display: flex;
      justify-content: space-between;
      font-size: 0.875rem;
      opacity: 0.85;
    }

    .caption {
      font-size: 0.75rem;
      opacity: 0.85;
    }

    .buttons {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-2);
    }
  `,
})
export class FitToGroupingsDialog {
  /** The times of the runs the groups come from, oldest first. */
  readonly runs = input.required<readonly (readonly number[])[]>();

  protected readonly models = BREAK_MODELS;
  private readonly tweaks = inject(Tweaks);
  protected readonly kind = this.tweaks.breakModelKind;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** The groupings as typed. */
  private readonly myGroupings = inject(MyGroupings);
  private readonly text = this.myGroupings.text;
  private readonly groups = this.myGroupings.groups;
  protected readonly mistake = this.myGroupings.mistake;
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
  /** Whether the search running, or the last one, fits the run-count curve rather than its end, all the runs alone. */
  private readonly curveFit = signal(false);
  /** The model and groupings the last fit was for. */
  private readonly fittedFor = signal<
    { readonly kind: BreakModelKind; readonly text: string } | undefined
  >(undefined);
  /**
   * How the model picked is fitted to the groupings as typed, to the run-count curve or its end: until either changes,
   * there's nothing to fit that way.
   */
  protected readonly fitted = computed(() => {
    const fitted = this.fittedFor();
    return fitted?.kind === this.kind() && fitted.text === this.text()
      ? this.curveFit()
        ? 'curve'
        : 'end'
      : undefined;
  });
  /** Whether the groupings and the model are kept as they are, while fitting. */
  protected readonly locked = computed(() => this.progress() !== undefined);
  private abort: AbortController | undefined;
  /** The run-count curve drawn last, and the model it's of. */
  private readonly curve = signal<
    | {
        /** The F1 score of each set of runs drawn, by count from 1. */
        readonly scores: readonly (readonly number[])[];
        readonly kind: BreakModelKind;
      }
    | undefined
  >(undefined);
  /** The model whose run-count curve is being drawn, while it is. */
  protected readonly curving = signal<BreakModelKind | undefined>(undefined);
  private curveAbort: AbortController | undefined;
  /** The model whose run-count curve shows, or is being drawn. */
  protected readonly curveKind = computed(() => this.curving() ?? this.curve()?.kind);
  protected readonly curvePlot = computed(() => {
    const curve = this.curve();
    return curve === undefined ? undefined : plotOf(curve.scores, curve.kind);
  });

  protected readonly status = computed(() => {
    if (this.mistake() !== undefined) {
      return '';
    }
    if (this.groups().length === 0) {
      return 'Type or paste the decimals of π as you group them in the Group tab on top of Your Runs.';
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
      const best = running.best.score.toFixed(2);
      return this.curveFit()
        ? `${stage}: best score ${best} so far, of F1 with all runs and fewer.`
        : `${stage}: best F1 ${best} so far.`;
    }
    const current = this.current();
    return current === undefined ? '' : `Now: F1 ${f1(current)}. ${details(current)}`;
  });

  /** Opens the dialog, with the groupings typed last. */
  async open(): Promise<void> {
    await this.myGroupings.load();
    this.fittedFor.set(undefined);
    this.curve.set(undefined);
    this.dialog().nativeElement.showModal();
    void this.drawCurve();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  /** Stops the search, if it runs, leaving the hyperparameters as they were, and the curve. */
  protected stop(): void {
    this.abort?.abort();
    this.curveAbort?.abort();
  }

  protected pick(kind: BreakModelKind): void {
    void this.tweaks.setBreakModel(kind);
  }

  /** Where the menu of models opens: under the button pressed, in window coordinates. */
  protected under(event: Event): { readonly x: number; readonly y: number } {
    const button = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: button.left + button.width / 2, y: button.bottom };
  }

  /**
   * Fits the model picked to the groups, with all the runs or, to fit its run-count curve, with fewer too; sets its
   * sliders to the best values found, and draws their run-count curve.
   */
  protected async fit(curve: boolean): Promise<void> {
    const kind = this.kind();
    const text = this.text();
    const ready = this.ready();
    this.curveAbort?.abort();
    const abort = new AbortController();
    this.abort = abort;
    this.fittedFor.set(undefined);
    this.curveFit.set(curve);
    const breathe = breather();
    const best = await fitToGroupings(kind, this.tweaks.grouping(), this.runs(), this.labels(), {
      signal: abort.signal,
      curve,
      pinned: this.tweaks.pinsOf(kind),
      pause: async (progress) => {
        this.progress.set(progress);
        await breathe();
      },
    });
    this.progress.set(undefined);
    if (abort.signal.aborted || !ready) {
      return;
    }
    await this.tweaks.setGrouping(tunedOnly(kind, best.settings));
    this.fittedFor.set({ kind, text });
    await this.drawCurve();
  }

  /** Draws the run-count curve of the model as set, over the groupings as typed, stopping any drawn before. */
  private async drawCurve(): Promise<void> {
    this.curveAbort?.abort();
    this.curving.set(undefined);
    if (!this.ready()) {
      return;
    }
    const abort = new AbortController();
    this.curveAbort = abort;
    const kind = this.kind();
    const runs = this.runs();
    this.curving.set(kind);
    const scores = await runCountCurve(kind, this.tweaks.grouping(), runs, this.labels(), {
      signal: abort.signal,
      pause: breather(),
    });
    if (this.curveAbort !== abort) {
      return;
    }
    this.curving.set(undefined);
    // Only whole: closing the dialog stops it short.
    if (scores.length === runs.length) {
      this.curve.set({ scores, kind });
    }
  }
}

/** Lets the page draw, when called, if it hasn't for a frame's time. */
function breather(): () => Promise<void> {
  let paused = performance.now();
  return async () => {
    if (performance.now() - paused > FRAME) {
      await new Promise((resolve) => setTimeout(resolve));
      paused = performance.now();
    }
  };
}

/** The settings, or `undefined` if they're all the model's defaults. */
function tunedOnly(kind: BreakModelKind, settings: Settings): Settings | undefined {
  return Object.keys(kind.defaults).some((key) => settings[key] !== kind.defaults[key])
    ? settings
    : undefined;
}

/**
 * The run-count curve of a model as a plot: a faint dot for the F1 score of each set of runs drawn, and a line through
 * their mean at each count, between faint lines at 0 and 1, the range of F1.
 */
function plotOf(curve: readonly (readonly number[])[], kind: BreakModelKind): Plot {
  const means = curve.map(
    (scores) => scores.reduce((sum, score) => sum + score, 0) / scores.length,
  );
  const counts = curve.length;
  return {
    title: `Run-count curve of ${kind.label}`,
    caption:
      `F1 from 0 to 1 with each number of runs, a dot for each random set of them: ` +
      `${(means[0] ?? 0).toFixed(2)} with 1 run, ${(means.at(-1) ?? 0).toFixed(2)} with all ${String(counts)}.`,
    x: { min: 1, max: counts, labels: ['1 run', `${String(counts)} runs`] },
    y: { min: 0, max: 1 },
    layers: [
      { kind: 'hline', y: 0, role: 'faint' },
      { kind: 'hline', y: 1, role: 'faint' },
      {
        kind: 'dots',
        points: curve.flatMap((scores, k) => scores.map((score) => [k + 1, score] as const)),
        role: 'faint',
      },
      { kind: 'line', points: means.map((mean, k) => [k + 1, mean] as const), role: 'aggregate' },
    ],
  };
}

function f1(score: Score): string {
  return score.f1.toFixed(2);
}

/** The breaks matched, of all those of the groups, and the extra ones. */
function details({ matched, missed, extra }: Score): string {
  return `${String(matched)} of ${String(matched + missed)} breaks matched, ${String(extra)} extra.`;
}
