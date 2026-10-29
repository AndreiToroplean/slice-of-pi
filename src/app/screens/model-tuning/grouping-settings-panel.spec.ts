import { CdkMenuItem } from '@angular/cdk/menu';
import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { installDialogs, uninstallDialogs } from '../../../testing/fake-dialogs';
import { menuItem, menuItems, openMenu } from '../../../testing/menus';
import { WRITE_CLIPBOARD } from '../tuning/copy-values';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { parseTweaks, Tweaks, TWEAKS } from '../../developer-mode/tweaks';
import { readBackup } from '../../player-data/backup';
import { INDEXED_DB, IS_PREVIEW } from '../../player-data/run-store';
import type { Hyperparameter, Settings } from '../../game/grouping/break-models/break-model';
import { BREAK_MODELS } from '../../game/grouping/break-models/break-models';
import { oneIn } from '../../game/grouping/break-models/hyperparameters';
import { LUNA, LUNA_DEFAULTS } from '../../game/grouping/break-models/luna';
import { MARS } from '../../game/grouping/break-models/mars';
import { MERCURY, MERCURY_DEFAULTS } from '../../game/grouping/break-models/mercury';
import { GroupingSettingsPanel, nameOf, rowsOf } from './grouping-settings-panel';
import { PLAY_WITH_MERCURY } from '../../../testing/game-break-model';
import { Dropdown } from '../../ui/menu';

/** The panel, given an overflow menu copying its values, as Model Tuning gives it one. */
@Component({
  imports: [CdkMenuItem, Dropdown, GroupingSettingsPanel],
  template: `
    <app-grouping-settings-panel #panel [menu]="menu" />
    <ng-template #menu>
      <div appDropdown>
        <button type="button" cdkMenuItem (cdkMenuItemTriggered)="void panel.copy()">
          Copy Hyperparameter Values
        </button>
      </div>
    </ng-template>
  `,
})
class PanelHost {
  readonly panel = viewChild.required(GroupingSettingsPanel);
}

describe('GroupingSettingsPanel', () => {
  beforeEach(() => {
    installDialogs();
  });
  afterEach(() => {
    uninstallDialogs();
  });

  let copied: string[];
  /** What the panel told, such as the values being imported. */
  let told: string[];

  async function setUp(): Promise<{ host: HTMLElement; detect: () => void }> {
    copied = [];
    told = [];
    TestBed.configureTestingModule({
      providers: [
        PLAY_WITH_MERCURY,
        { provide: IS_PREVIEW, useValue: false },
        { provide: INDEXED_DB, useValue: new IDBFactory() },
        {
          provide: WRITE_CLIPBOARD,
          useValue: (text: string) => {
            copied.push(text);
            return Promise.resolve();
          },
        },
      ],
    });
    await TestBed.inject(DeveloperMode).set(true);
    await TestBed.inject(Tweaks).loaded;
    const fixture = TestBed.createComponent(PanelHost);
    fixture.detectChanges();
    fixture.componentInstance.panel().told.subscribe((message) => told.push(message));
    fixture.detectChanges();
    return {
      host: fixture.nativeElement as HTMLElement,
      detect: () => {
        fixture.detectChanges();
      },
    };
  }

  function slider(host: HTMLElement, key: string): HTMLInputElement {
    const input = host.querySelector<HTMLInputElement>(`#setting-${key}`);
    if (input === null) {
      throw new Error(`No slider for ${key}`);
    }
    return input;
  }

  function buttonLabelled(host: HTMLElement, label: string): HTMLButtonElement {
    const found = Array.from(host.querySelectorAll('button')).find(
      (button) => button.textContent.trim() === label,
    );
    if (found === undefined) {
      throw new Error(`No button "${label}"`);
    }
    return found;
  }

  function move(input: HTMLInputElement, position: number): void {
    input.value = String(position);
    input.dispatchEvent(new Event('input'));
  }

  function settings(): Settings {
    return TestBed.inject(Tweaks).grouping();
  }

  it('opens the menu given to it from a plain ⋮ at the end of the tabs', async () => {
    const { host, detect } = await setUp();
    const more = host.querySelector<HTMLButtonElement>('.bar button[title="More"]');
    expect(more?.classList).not.toContain('candy');

    more?.click();
    detect();

    expect(more?.getAttribute('aria-expanded')).toBe('true');
    expect(menuItems()).toEqual(['Copy Hyperparameter Values']);
  });

  it('names each slider of a pair after it, side by side on one row of labels', async () => {
    const { host, detect } = await setUp();
    await TestBed.inject(Tweaks).setBreakModel(MARS);
    detect();
    const pair = Array.from(host.querySelectorAll('.row.pair')).at(0);

    expect(Array.from(pair?.querySelectorAll('label') ?? [], (label) => label.textContent)).toEqual(
      ['P1 size', 'P1 factor'],
    );
    expect(pair?.children.length).toBe(2);
  });

  it('has a labelled slider for every setting, at its default', async () => {
    const { host } = await setUp();

    for (const control of MERCURY.tabs.flatMap((tab) => tab.hyperparameters)) {
      const input = slider(host, control.key);
      expect(host.querySelector(`label[for="setting-${control.key}"]`)?.textContent).toBe(
        control.label,
      );
      expect(Number(input.min)).toBeLessThanOrEqual(Number(input.value));
      expect(Number(input.max)).toBeGreaterThanOrEqual(Number(input.value));
    }
    expect(slider(host, 'window').value).toBe('21');
    expect(slider(host, 'window').getAttribute('aria-valuetext')).toBe('21 intervals');
  });

  describe('the rows of a tab', () => {
    const slider = (key: string, pair?: string): Hyperparameter => ({
      key,
      label: key,
      min: 0,
      max: 1,
      step: 0.1,
      format: String,
      help: { what: '', why: '', moving: '' },
      ...(pair === undefined ? {} : { pair }),
    });

    it('gives each slider its own row, but a pair one after the other', () => {
      const rows = rowsOf([
        slider('a'),
        slider('Size', 'P1'),
        slider('Factor', 'P1'),
        slider('Size', 'P2'),
        slider('b'),
      ]);

      expect(rows.map((row) => [row.pair, row.sliders.map(nameOf)])).toEqual([
        [undefined, ['a']],
        ['P1', ['P1 size', 'P1 factor']],
        ['P2', ['P2 size']],
        [undefined, ['b']],
      ]);
    });
  });

  it.each(BREAK_MODELS)('puts every setting of $label in one tab', (kind) => {
    const keys = kind.tabs.flatMap((tab) => tab.hyperparameters.map(({ key }) => key));

    expect(keys.sort()).toEqual(Object.keys(kind.defaults).sort());
  });

  it('shows one tab at a time, the runs first', async () => {
    const { host, detect } = await setUp();
    const shown = (): string[] =>
      Array.from(
        host.querySelectorAll<HTMLElement>('[role="tabpanel"]:not([hidden])'),
        (pane) => pane.id,
      );

    expect(shown()).toEqual(['pane-Runs']);
    buttonLabelled(host, 'Mixture').click();
    detect();

    expect(shown()).toEqual(['pane-Mixture']);
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent.trim()).toBe(
      'Mixture',
    );
  });

  it('pins a setting for fitting while its pin is pressed, for the model picked', async () => {
    const { host, detect } = await setUp();
    const pin = host.querySelector<HTMLButtonElement>(
      'button[title="Pin the prior baseline when fitting"]',
    );
    const tweaks = TestBed.inject(Tweaks);
    const kind = tweaks.breakModelKind();

    pin?.click();
    detect();
    expect([...tweaks.pinsOf(kind)]).toEqual(['priorBaseline']);
    expect(pin?.getAttribute('aria-pressed')).toBe('true');

    pin?.click();
    detect();
    expect(tweaks.pinsOf(kind).size).toBe(0);
    expect(pin?.getAttribute('aria-pressed')).toBe('false');
  });

  it('changes the setting as its slider moves, and shows its value', async () => {
    const { host, detect } = await setUp();

    move(slider(host, 'level'), 0.95);
    detect();

    expect(settings()['level']).toBe(0.95);
    expect(host.querySelector('output[for="setting-level"]')?.textContent).toBe('0.95');
  });

  it('says how many runs back a run counts half, or that every run counts the same', async () => {
    const { host, detect } = await setUp();
    const output = (): string | undefined =>
      host.querySelector('output[for="setting-recencyDecay"]')?.textContent;

    expect(output()).toBe('0.90 (half weight 6.6 runs back)');
    move(slider(host, 'recencyDecay'), 1);
    detect();

    expect(output()).toBe('1 (every run the same)');
  });

  it('says a share of intervals as one digit out of how many', async () => {
    const { host, detect } = await setUp();
    const output = (): string | undefined =>
      host.querySelector('output[for="setting-priorBreakShare"]')?.textContent;

    expect(output()).toBe('0.15 (1 in 6.7 digits)');
    move(slider(host, 'priorBreakShare'), 0.2);
    detect();

    expect(output()).toBe('0.20 (1 in 5 digits)');
    expect(oneIn(1 / 3.5)).toBe('3.5');
  });

  it('says an interval as how many digits a second it makes', async () => {
    const { host, detect } = await setUp();
    const output = (): string | undefined =>
      host.querySelector('output[for="setting-priorBaseline"]')?.textContent;

    expect(output()).toBe('300 ms (3.3 digits/s)');
    move(slider(host, 'priorBaseline'), 250);
    detect();

    expect(output()).toBe('250 ms (4 digits/s)');
  });

  it('brings back the game’s value of one setting, keeping the others', async () => {
    const { host, detect } = await setUp();
    const revert = (): HTMLButtonElement | null =>
      slider(host, 'window')
        .closest('.setting')
        ?.querySelector<HTMLButtonElement>('button[title="Back to Default"]') ?? null;

    expect(revert()?.disabled).toBe(true);
    move(slider(host, 'window'), 11);
    move(slider(host, 'level'), 0.95);
    detect();
    expect(revert()?.disabled).toBe(false);
    revert()?.click();
    detect();

    expect(settings()).toEqual({ ...MERCURY_DEFAULTS, level: 0.95 });
    expect(slider(host, 'window').value).toBe('21');
    expect(revert()?.disabled).toBe(true);
  });

  it('opens the help of a setting in a dialog, and closes it', async () => {
    const { host, detect } = await setUp();
    const dialog = host.querySelector('dialog');

    host.querySelector<HTMLButtonElement>('button[title="About Recency decay"]')?.click();
    detect();

    expect(dialog?.open).toBe(true);
    expect(dialog?.querySelector('h2')?.textContent).toBe('Recency decay');
    expect(dialog?.textContent).toContain('Why this way.');
    buttonLabelled(host, 'Close').click();
    detect();

    expect(dialog?.open).toBe(false);
    expect(dialog?.querySelector('h2')).toBeNull();
  });

  it('keeps the tuned settings, and none once they are all back to their defaults', async () => {
    const { host } = await setUp();
    const tweaks = TestBed.inject(Tweaks);

    move(slider(host, 'window'), 11);
    expect(tweaks.values().grouping).toEqual({ mercury: { ...MERCURY_DEFAULTS, window: 11 } });
    move(slider(host, 'window'), 21);
    expect(tweaks.values().grouping).toBeUndefined();
  });

  it('copies the break model and the values of all its settings, as a backup holding them', async () => {
    const { host, detect } = await setUp();

    move(slider(host, 'level'), 0.95);
    detect();
    host.querySelector<HTMLButtonElement>('.bar button[title="More"]')?.click();
    detect();
    menuItem('Copy Hyperparameter Values').click();
    await vi.waitFor(() => {
      expect(copied).toHaveLength(1);
    });
    const backup = readBackup(copied[0] ?? '');
    expect('settings' in backup && parseTweaks(backup.settings[TWEAKS])).toEqual({
      breakModel: MERCURY.id,
      grouping: { mercury: { ...MERCURY_DEFAULTS, level: 0.95 } },
    });
  });

  it('picks the break model on a tab of its own, its own tabs after it', async () => {
    const { host, detect } = await setUp();
    const pane = (): HTMLElement => host.querySelector<HTMLElement>('#pane-Model') ?? host;
    const tabs = (): string[] =>
      Array.from(host.querySelectorAll('[role="tab"]'), (tab) => tab.textContent.trim());
    buttonLabelled(host, 'Model').click();
    detect();
    expect(pane().hidden).toBe(false);
    expect(pane().querySelector('#model-name')?.textContent).toBe(MERCURY.label);
    pane().querySelector<HTMLButtonElement>('[aria-labelledby="model-label model-name"]')?.click();
    detect();
    const models = Array.from(openMenu()?.querySelectorAll('[role="menuitemradio"]') ?? []);
    expect(
      models.map((item) => item.querySelector('span')?.firstChild?.textContent?.trim()),
    ).toEqual(BREAK_MODELS.map((kind) => kind.label));
    expect(models.map((item) => item.getAttribute('aria-checked'))).toEqual(
      BREAK_MODELS.map((kind) => String(kind === MERCURY)),
    );

    menuItem(LUNA.label).click();
    await vi.waitFor(() => {
      expect(TestBed.inject(Tweaks).breakModelKind()).toBe(LUNA);
    });
    detect();

    expect(pane().querySelector('#model-name')?.textContent).toBe(LUNA.label);
    expect(tabs()).toEqual(['Runs', 'Model', ...LUNA.tabs.map(({ name }) => name)]);
  });

  describe('importing from another model', () => {
    /** Tunes Mercury's window and recency decay, then picks Luna, which has them too. */
    async function onLuna(): Promise<{ host: HTMLElement; detect: () => void }> {
      const panel = await setUp();
      move(slider(panel.host, 'window'), 11);
      move(slider(panel.host, 'recencyDecay'), 0.8);
      await TestBed.inject(Tweaks).setBreakModel(LUNA);
      panel.detect();
      return panel;
    }

    it('imports all the hyperparameters another model shares with the one picked, from its picker', async () => {
      const { host, detect } = await onLuna();
      move(slider(host, 'pauseMargin'), 1.5);
      const pane = host.querySelector<HTMLElement>('#pane-Model') ?? host;
      pane
        .querySelector<HTMLButtonElement>('[aria-labelledby="import-label import-name"]')
        ?.click();
      detect();
      expect(menuItems()).toContain('Venus');

      menuItem('Mercury').click();

      expect(settings()).toEqual({
        ...LUNA_DEFAULTS,
        window: 11,
        recencyDecay: 0.8,
        pauseMargin: 1.5,
      });
      expect(told).toEqual(['Imported the shared hyperparameters from Mercury.']);
    });

    it('imports one hyperparameter from the model picked in its menu', async () => {
      const { host, detect } = await onLuna();
      const importOne = host.querySelector<HTMLButtonElement>(
        '[title="Import the window from another model"]',
      );
      importOne?.click();
      detect();

      menuItem('From Mercury').click();

      expect(settings()).toEqual({ ...LUNA_DEFAULTS, window: 11 });
      expect(host.querySelector('[title="Import the pause margin from another model"]')).toBe(null);
    });
  });
});
