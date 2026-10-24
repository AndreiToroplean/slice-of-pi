import { Component, computed, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { WRITE_CLIPBOARD } from '../tuning/copy-values';
import { groupingText, Tweaks } from '../../developer-mode/tweaks';
import { DropdownMenu } from '../../ui/dropdown-menu';
import type {
  BreakModelKind,
  Hyperparameter,
  Settings,
} from '../../game/grouping/break-models/break-model';
import { BREAK_MODELS } from '../../game/grouping/break-models/break-models';

/** The tab of what is given to the panel. */
const RUNS_TAB = 'Runs';

/** The keys of a break model's hyperparameters. */
function keysOf(kind: BreakModelKind): string[] {
  return kind.tabs.flatMap(({ hyperparameters }) => hyperparameters.map(({ key }) => key));
}

/**
 * Developer mode's tabs on Your Runs: one with what is given to it, the runs, and the others with the sliders for every
 * hyperparameter of the break model picked, a few to a tab, each with a toggle button pinning it, so that fitting the
 * model to the player's groups leaves it where it is (kept with the tweaks, for each model), a button bringing back the game's value and a help button
 * opening a dialog that says what it does, and, where another model has it too, a button copying its value from one of
 * them. Beside the tabs, an overflow menu shows
 * the break model picked and switches it, copies the values of the hyperparameters it shares with another model, and
 * has buttons to copy the settings' values so they go into the code and to bring back the game's settings, then what
 * is given to it marked `menuItem`.
 */
@Component({
  selector: 'app-grouping-settings-panel',
  imports: [DropdownMenu],
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
          Back to the Game's Settings
        </button>
        <hr />
        <ng-content select="[menuItem]" />
      </app-dropdown-menu>
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
              <button
                type="button"
                class="round pin"
                [attr.aria-label]="'Pin the ' + control.label.toLowerCase() + ' when fitting'"
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
                    'Copy the ' + control.label.toLowerCase() + ' from another model'
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
                  [label]="'Copy the ' + control.label.toLowerCase()"
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
  /** The keys of the hyperparameters of the break model picked that fitting it leaves where they are. */
  protected readonly pinned = computed(() => this.tweaks.pinsOf(this.kind()));
  /** The break models to switch to: all but the one picked. */
  protected readonly otherModels = computed(() =>
    BREAK_MODELS.filter((each) => each !== this.kind()),
  );
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
  protected readonly copyText = computed(() =>
    groupingText(this.kind(), this.tweaks.values().grouping?.[this.kind().id]),
  );
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
    const settings = { ...this.settings(), ...values };
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

  protected togglePin(key: string): void {
    void this.tweaks.togglePin(this.kind(), key);
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
