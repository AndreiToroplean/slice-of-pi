import { Component, computed, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { WRITE_CLIPBOARD } from '../tuning/copy-values';
import { groupingText, Tweaks } from '../../developer-mode/tweaks';
import { OverflowMenu } from '../../ui/overflow-menu';
import { ChartGuides } from './chart-guides';
import { GUIDE_COLORS } from './model-views';
import type { BreakModelKind, Hyperparameter } from '../../game/grouping/break-models/break-model';
import { BREAK_MODELS } from '../../game/grouping/break-models/break-models';

/** The tab of what is given to the panel. */
const RUNS_TAB = 'Runs';

/**
 * Developer mode's tabs on Your Runs: one with what is given to it, the runs, and the others with the sliders for every
 * hyperparameter of the break model picked, a few to a tab, each with a button bringing back the game's value and a help button
 * opening a dialog that says what it does, and, where it acts on a chart, a checkbox to show it there as dashed lines.
 * Beside the tabs, an overflow menu picks the break model, and has buttons to copy the settings' values so they go into
 * the code and to bring back the game's settings, then what is given to it marked `menuItem`.
 */
@Component({
  selector: 'app-grouping-settings-panel',
  imports: [OverflowMenu],
  template: `
    <div class="bar">
      <div class="tabs" role="tablist" aria-label="Your runs and the grouping settings">
        @for (name of tabNames(); track name) {
          <button
            type="button"
            role="tab"
            [id]="'tab-' + name"
            [attr.aria-controls]="'pane-' + name"
            [attr.aria-selected]="tab() === name"
            (click)="tab.set(name)"
          >
            {{ name }}
          </button>
        }
      </div>
      <app-overflow-menu>
        <fieldset class="models">
          <legend>Break Model</legend>
          @for (each of models; track each.name) {
            <label class="toggle">
              <input
                type="radio"
                name="break-model"
                [checked]="each === kind()"
                (change)="pick(each)"
              />
              <span class="model">
                {{ each.label }}
                <small>{{ each.description }}</small>
              </span>
            </label>
          }
        </fieldset>
        <hr />
        <button type="button" (click)="void copy()">Copy Hyperparameter Values</button>
        <button type="button" [disabled]="!tuned()" (click)="reset()">
          Back to the Game's Settings
        </button>
        <hr />
        <ng-content select="[menuItem]" />
      </app-overflow-menu>
    </div>
    <div
      class="pane runs-pane"
      role="tabpanel"
      id="pane-Runs"
      aria-labelledby="tab-Runs"
      [hidden]="tab() !== runsTab"
    >
      <ng-content />
    </div>
    @for (settingTab of kind().tabs; track settingTab.name) {
      <div
        class="pane settings"
        role="tabpanel"
        [id]="'pane-' + settingTab.name"
        [attr.aria-labelledby]="'tab-' + settingTab.name"
        [hidden]="tab() !== settingTab.name"
      >
        @for (control of settingTab.hyperparameters; track control.key) {
          <div class="setting">
            <div class="top">
              <label [for]="'setting-' + control.key">{{ control.label }}</label>
              @if (guideColors[control.key]; as color) {
                <input
                  type="checkbox"
                  class="guide"
                  [style.accent-color]="color"
                  [attr.aria-label]="'Show ' + control.label.toLowerCase() + ' on the charts'"
                  [checked]="guides().has(control.key)"
                  (change)="chartGuides.toggle(control.key)"
                />
              }
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
            <output [for]="'setting-' + control.key">{{ formatted(control) }}</output>
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
      </div>
    }
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
  styles: `
    /* As tall as the page leaves it, the panes sharing it in turn. */
    :host {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .bar {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    /* The tabs, on a frosted strip: the one shown is white. */
    .tabs {
      flex: 1;
      min-width: 0;
      display: flex;
      gap: 0.25rem;
      padding: 0.1875rem;
      border-radius: 1rem;
      background: var(--frost);
      box-shadow: inset 0 1px 0 var(--frost-highlight);
    }

    [role='tab'] {
      flex: 1;
      min-width: 0;
      padding: 0.5rem 0.125rem;
      border: none;
      border-radius: 0.8125rem;
      background: none;
      color: inherit;
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 500;
      text-shadow: var(--text-shadow);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    [role='tab'][aria-selected='true'] {
      background: var(--candy);
      color: var(--on-candy);
      text-shadow: none;
    }

    [role='tab']:focus-visible {
      outline: 0.1875rem solid var(--focus-ring);
      outline-offset: 0.125rem;
    }

    .pane {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .pane[hidden] {
      display: none;
    }

    /* Four rows sharing the height left, one slider to a row, so that a tab's sliders always fit. */
    .settings {
      display: grid;
      grid-template-rows: repeat(4, minmax(min-content, 1fr));
      padding: 0 var(--space-1);
    }

    .setting {
      display: grid;
      align-content: center;
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

    /* The label and the value on lines of their own, so that neither wraps the other. */
    label,
    output {
      line-height: 1.2;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      text-shadow: var(--text-shadow);
    }

    label {
      flex: 1;
      font-weight: 500;
    }

    output {
      font-size: 0.8125rem;
      font-variant-numeric: tabular-nums;
      opacity: 0.9;
    }
    /* The break models to pick from, each with what it does under its name. */
    .models {
      margin: 0;
      padding: 0;
      border: none;
    }

    legend {
      padding: 0 1rem;
      font-size: 0.8125rem;
      opacity: 0.8;
    }

    .model {
      display: grid;
      max-width: 15rem;
    }

    .model small {
      font-size: 0.75rem;
      font-weight: 400;
      opacity: 0.85;
    }

    /* Shows the setting on the charts, where it acts, as dashed lines. */
    .guide {
      width: 1.125rem;
      height: 1.125rem;
      margin: 0 0.25rem;
    }

    .round {
      display: grid;
      place-items: center;
      width: 1.5rem;
      height: 1.5rem;
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
      width: 0.875rem;
      height: 0.875rem;
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
  /** Tells what happened, such as the values being copied. */
  readonly told = output<string>();

  protected readonly runsTab = RUNS_TAB;
  /** The settings that can be shown on the charts, and those shown. */
  protected readonly guideColors: Readonly<Record<string, string | undefined>> = GUIDE_COLORS;
  protected readonly chartGuides = inject(ChartGuides);
  protected readonly guides = this.chartGuides.shown;
  /** The break models to pick from. */
  protected readonly models = BREAK_MODELS;
  protected readonly tabNames = computed(() => [
    RUNS_TAB,
    ...this.kind().tabs.map(({ name }) => name),
  ]);
  /** The tab shown. */
  protected readonly tab = signal(RUNS_TAB);
  /** The setting whose help is open, if any. */
  protected readonly helped = signal<Hyperparameter | undefined>(undefined);
  private readonly helpDialog = viewChild.required<ElementRef<HTMLDialogElement>>('helpDialog');

  private readonly tweaks = inject(Tweaks);
  private readonly writeClipboard = inject(WRITE_CLIPBOARD);
  /** The break model picked, and its hyperparameters. */
  protected readonly kind = this.tweaks.breakModelKind;
  private readonly settings = this.tweaks.grouping;
  /** The settings as text, to hand back so they go into the code. */
  protected readonly copyText = computed(() => groupingText(this.kind(), this.settings()));
  protected readonly tuned = computed(() => this.tweaks.values().grouping !== undefined);

  protected formatted(control: Hyperparameter): string {
    return control.format(this.position(control));
  }

  protected position(control: Hyperparameter): number {
    return this.settings()[control.key] ?? this.defaultOf(control);
  }

  protected revertLabel(control: Hyperparameter): string {
    return `Back to the game's ${control.label.toLowerCase()}`;
  }

  protected isDefault(control: Hyperparameter): boolean {
    return this.position(control) === this.defaultOf(control);
  }

  protected pick(kind: BreakModelKind): void {
    void this.tweaks.setBreakModel(kind);
  }

  protected set(control: Hyperparameter, event: Event): void {
    this.apply(control, Number((event.target as HTMLInputElement).value));
  }

  /** Brings back the game's value of one setting. */
  protected revert(control: Hyperparameter): void {
    this.apply(control, this.defaultOf(control));
  }

  private defaultOf(control: Hyperparameter): number {
    return this.kind().defaults[control.key] ?? control.min;
  }

  private apply(control: Hyperparameter, value: number): void {
    const settings = { ...this.settings(), [control.key]: value };
    const { defaults } = this.kind();
    const tuned = Object.keys(defaults).some((key) => settings[key] !== defaults[key]);
    void this.tweaks.setGrouping(tuned ? settings : undefined);
  }

  protected showHelp(control: Hyperparameter): void {
    this.helped.set(control);
    this.helpDialog().nativeElement.showModal();
  }

  protected closeHelp(): void {
    this.helpDialog().nativeElement.close();
  }

  protected reset(): void {
    void this.tweaks.setGrouping(undefined);
  }

  /** Copies the settings' values as text, to hand back so they go into the code. */
  protected async copy(): Promise<void> {
    try {
      await this.writeClipboard(this.copyText());
      this.told.emit('Copied the hyperparameter values.');
    } catch {
      this.told.emit("Couldn't copy the hyperparameter values.");
    }
  }
}
