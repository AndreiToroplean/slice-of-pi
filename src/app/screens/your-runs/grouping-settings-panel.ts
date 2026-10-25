import { Component, computed, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { WRITE_CLIPBOARD } from '../tuning/copy-values';
import { RUN_CLOCK } from '../../player-data/run-recorder';
import { Tweaks, tweaksBackup } from '../../developer-mode/tweaks';
import { DropdownMenu } from '../../ui/dropdown-menu';
import type {
  BreakModelKind,
  Hyperparameter,
  Settings,
} from '../../game/grouping/break-models/break-model';
import { BREAK_MODELS } from '../../game/grouping/break-models/break-models';
import { Candy } from '../../ui/candy';
import { LightDismiss } from '../../ui/light-dismiss';
import { Segment, Segmented } from '../../ui/segmented';

/** The tab of what is given to the panel. */
const RUNS_TAB = 'Runs';

/** A row of sliders in a tab: one, or the sliders of a pair side by side, under its name. */
export interface SliderRow {
  readonly pair?: string;
  readonly sliders: readonly Hyperparameter[];
}

/** The rows of a tab's sliders, in order: the sliders of a pair one after the other share a row. */
export function rowsOf(sliders: readonly Hyperparameter[]): SliderRow[] {
  const rows: SliderRow[] = [];
  for (const slider of sliders) {
    const last = rows.at(-1);
    if (slider.pair !== undefined && last?.pair === slider.pair) {
      rows[rows.length - 1] = { pair: slider.pair, sliders: [...last.sliders, slider] };
    } else {
      rows.push(
        slider.pair === undefined
          ? { sliders: [slider] }
          : { pair: slider.pair, sliders: [slider] },
      );
    }
  }
  return rows;
}

/** What a slider is called on its own: its label, after its pair's name if it's in one. */
export function nameOf(slider: Hyperparameter): string {
  return slider.pair === undefined ? slider.label : `${slider.pair} ${slider.label.toLowerCase()}`;
}

/** The keys of a break model's hyperparameters. */
function keysOf(kind: BreakModelKind): string[] {
  return kind.tabs.flatMap(({ hyperparameters }) => hyperparameters.map(({ key }) => key));
}

/**
 * Developer mode's tabs on Your Runs: one with what is given to it, the runs, and the others with the sliders for every
 * hyperparameter of the break model picked, a few to a tab, scrolling if they don't fit, a pair of sliders sharing a row, each with a toggle button pinning it, so that fitting the
 * model to the player's groups leaves it where it is (kept with the tweaks, for each model), a button bringing back the game's value and a help button
 * opening a dialog that says what it does, and, where another model has it too, a button copying its value from one of
 * them. Beside the tabs, an overflow menu shows
 * the break model picked and switches it, copies the values of the hyperparameters it shares with another model, and
 * has buttons to copy the settings' values so they go into the code and to bring back the game's settings, then what
 * is given to it marked `menuItem`.
 */
@Component({
  selector: 'app-grouping-settings-panel',
  imports: [Candy, LightDismiss, DropdownMenu, Segmented],
  template: `
    <div class="bar">
      <app-segmented
        class="tabs"
        label="Your runs and the grouping settings"
        panels="pane"
        [segments]="tabs()"
        [(value)]="tab"
      />
      <app-dropdown-menu>
        <button type="button" class="model" disabled>
          Model: {{ kind().label }} Is Selected
          <small>{{ kind().description }}</small>
        </button>
        @for (each of otherModels(); track each.id) {
          <button type="button" class="model" (click)="pick(each)">
            Model: Switch to {{ each.label }}
            <small>{{ each.description }}</small>
          </button>
        }
        @if (sources().length > 0) {
          <hr />
          @for (source of sources(); track source.id) {
            <button type="button" (click)="copyFrom(source)">
              Copy Shared Hyperparameters From {{ source.label }}
            </button>
          }
        }
        <hr />
        <button type="button" (click)="void copy()">Copy Hyperparameter Values</button>
        <button type="button" [disabled]="!tuned()" (click)="reset()">
          Back to Default Settings
        </button>
        <hr />
        <ng-content select="[menuItem]" />
      </app-dropdown-menu>
    </div>
    <div
      class="pane runs-pane"
      role="tabpanel"
      id="pane-Runs"
      aria-labelledby="pane-tab-Runs"
      [hidden]="tab() !== runsTab"
    >
      <ng-content />
    </div>
    @for (settingTab of kind().tabs; track settingTab.name) {
      <div
        class="pane settings"
        role="tabpanel"
        [id]="'pane-' + settingTab.name"
        [attr.aria-labelledby]="'pane-tab-' + settingTab.name"
        [hidden]="tab() !== settingTab.name"
      >
        @for (row of rowsOf(settingTab.hyperparameters); track row.sliders[0]?.key) {
          <div
            class="row"
            [class.pair]="row.pair !== undefined"
            [attr.role]="row.pair === undefined ? null : 'group'"
            [attr.aria-labelledby]="row.pair === undefined ? null : 'pair-' + row.sliders[0]?.key"
          >
            @if (row.pair !== undefined) {
              <span class="pair-name" [id]="'pair-' + row.sliders[0]?.key">{{ row.pair }}</span>
            }
            @for (control of row.sliders; track control.key) {
              <div class="setting">
                <div class="top">
                  <label [for]="'setting-' + control.key">{{ control.label }}</label>
                  <button
                    type="button"
                    class="round pin"
                    [attr.aria-label]="'Pin the ' + name(control).toLowerCase() + ' when fitting'"
                    [attr.aria-pressed]="pinned().has(control.key)"
                    (click)="togglePin(control.key)"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 17v5" />
                      <path d="M9 4h6l-1 6 3 3v4H7v-4l3-3z" />
                    </svg>
                  </button>
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
                  @if (copySources().get(control.key); as others) {
                    <button
                      type="button"
                      class="round"
                      [attr.aria-label]="
                        'Copy the ' + name(control).toLowerCase() + ' from another model'
                      "
                      (click)="copyMenu.openAt(under($event))"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M15 5V4a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h1" />
                      </svg>
                    </button>
                    <app-dropdown-menu
                      #copyMenu
                      [label]="'Copy the ' + name(control).toLowerCase()"
                      [button]="false"
                    >
                      @for (source of others; track source.id) {
                        <button type="button" (click)="copyFrom(source, [control.key])">
                          From {{ source.label }}
                        </button>
                      }
                    </app-dropdown-menu>
                  }
                  <button
                    type="button"
                    class="round"
                    aria-haspopup="dialog"
                    [attr.aria-label]="'About ' + name(control)"
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
      </div>
    }
    <dialog
      #helpDialog
      class="card"
      closedby="any"
      aria-labelledby="help-title"
      (close)="helped.set(undefined)"
    >
      @if (helped(); as control) {
        <h2 id="help-title">{{ name(control) }}</h2>
        <div class="explanation">
          <p><b>What it is.</b> {{ control.help.what }}</p>
          <p><b>Why this way.</b> {{ control.help.why }}</p>
          <p><b>Moving it.</b> {{ control.help.moving }}</p>
        </div>
        <button type="button" appCandy autofocus (click)="closeHelp()">Close</button>
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
      gap: calc(var(--space-2) / 2);
    }

    .bar {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    /* The tabs (see \`Segmented\`), filling the bar beside the menu. */
    .tabs {
      flex: 1;
      min-width: 0;
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

    /*
     * The sliders at their own height, a slider or a pair to a row: those that don't fit scroll, as the runs do, down to
     * the bottom of the page, under its padding and the navigation bar, the last of them stopping above them.
     */
    .settings {
      display: grid;
      align-content: start;
      gap: var(--space-1);
      margin-bottom: calc(-1 * var(--space-3) - env(safe-area-inset-bottom));
      padding: 0 var(--space-1) calc(var(--space-3) + env(safe-area-inset-bottom));
      overflow-y: auto;
      overscroll-behavior-y: contain;
    }

    .row {
      display: grid;
    }

    /* A pair side by side, under its name. */
    .row.pair {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: var(--space-3);
    }

    .pair-name {
      grid-column: 1 / -1;
      font-size: 0.8125rem;
      font-weight: 600;
      line-height: 1.2;
      text-shadow: var(--text-shadow);
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
    /* A break model, picked or to switch to, with what it does under its name. */
    .model {
      display: grid;
    }

    /* The one picked, readable but set apart. */
    .model:disabled {
      opacity: 0.75;
    }

    .model small {
      font-size: 0.75rem;
      font-weight: 400;
      opacity: 0.85;
    }

    /* Pinned: the colors of the tab shown, the pin filled. */
    .pin[aria-pressed='true'] {
      background: var(--candy);
      color: var(--on-candy);
    }

    .pin[aria-pressed='true'] path {
      fill: currentColor;
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
  protected readonly rowsOf = rowsOf;
  protected readonly name = nameOf;
  /** The keys of the hyperparameters of the break model picked that fitting it leaves where they are. */
  protected readonly pinned = computed(() => this.tweaks.pinsOf(this.kind()));
  /** The break models to switch to: all but the one picked. */
  protected readonly otherModels = computed(() =>
    BREAK_MODELS.filter((each) => each !== this.kind()),
  );
  protected readonly tabs = computed((): readonly Segment<string>[] =>
    [RUNS_TAB, ...this.kind().tabs.map(({ name }) => name)].map((name) => ({
      value: name,
      label: name,
    })),
  );
  /** The tab shown. */
  protected readonly tab = signal(RUNS_TAB);
  /** The setting whose help is open, if any. */
  protected readonly helped = signal<Hyperparameter | undefined>(undefined);
  private readonly helpDialog = viewChild.required<ElementRef<HTMLDialogElement>>('helpDialog');

  private readonly tweaks = inject(Tweaks);
  private readonly writeClipboard = inject(WRITE_CLIPBOARD);
  private readonly clock = inject(RUN_CLOCK);
  /** The break model picked, and its hyperparameters. */
  protected readonly kind = this.tweaks.breakModelKind;
  private readonly settings = this.tweaks.grouping;
  protected readonly tuned = computed(
    () => this.tweaks.values().grouping?.[this.kind().id] !== undefined,
  );
  /** The other break models, each with the keys of the hyperparameters it shares with the one picked, if any. */
  private readonly shared = computed(() => {
    const own = keysOf(this.kind());
    return BREAK_MODELS.flatMap((source) => {
      const keys = keysOf(source).filter((key) => own.includes(key));
      return source === this.kind() || keys.length === 0 ? [] : [{ source, keys }];
    });
  });
  /** The other break models that share hyperparameters with the one picked, to copy their values from. */
  protected readonly sources = computed(() => this.shared().map(({ source }) => source));
  /** For each hyperparameter another model has too, the models to copy its value from. */
  protected readonly copySources = computed(() => {
    const sources = new Map<string, BreakModelKind[]>();
    for (const { source, keys } of this.shared()) {
      for (const key of keys) {
        sources.set(key, [...(sources.get(key) ?? []), source]);
      }
    }
    return sources;
  });

  /** Shows the tab, the whole of it in the row of tabs, which may have scrolled it out of sight. */
  protected formatted(control: Hyperparameter): string {
    return control.format(this.position(control));
  }

  protected position(control: Hyperparameter): number {
    return this.settings()[control.key] ?? this.defaultOf(control);
  }

  protected revertLabel(control: Hyperparameter): string {
    return `Back to the default ${nameOf(control).toLowerCase()}`;
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
    this.applyAll({ [control.key]: value });
  }

  /**
   * Copies the values of the hyperparameters with these keys from another model, tuned or not, or of all those it shares
   * with the one picked.
   */
  protected copyFrom(source: BreakModelKind, keys?: readonly string[]): void {
    const values = { ...source.defaults, ...this.tweaks.values().grouping?.[source.id] };
    const copied = (keys ?? keysOf(this.kind())).flatMap((key) => {
      const value = values[key];
      return value === undefined ? [] : [[key, value] as const];
    });
    this.applyAll(Object.fromEntries(copied));
  }

  /** Where a menu opens under the button pressed, in window coordinates. */
  protected under(event: Event): { readonly x: number; readonly y: number } {
    const button = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: button.left + button.width / 2, y: button.bottom };
  }

  private applyAll(values: Settings): void {
    void this.tweaks.setGrouping({ ...this.settings(), ...values });
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

  protected togglePin(key: string): void {
    void this.tweaks.togglePin(this.kind(), key);
  }

  /** Copies the break model and its settings' values, tuned or not, to hand back so they go into the code. */
  protected async copy(): Promise<void> {
    try {
      const { id } = this.kind();
      const values = { breakModel: id, grouping: { [id]: this.settings() } };
      await this.writeClipboard(tweaksBackup(values, this.clock.epoch()));
      this.told.emit('Copied the hyperparameter values.');
    } catch {
      this.told.emit("Couldn't copy the hyperparameter values.");
    }
  }
}
