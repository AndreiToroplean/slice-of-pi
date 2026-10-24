import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { installDialogs, uninstallDialogs } from '../../../testing/fake-dialogs';
import { installPopovers, uninstallPopovers } from '../../../testing/fake-popovers';
import { WRITE_CLIPBOARD } from '../tuning/copy-values';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { groupingText, Tweaks } from '../../developer-mode/tweaks';
import { INDEXED_DB, IS_PREVIEW } from '../../player-data/run-store';
import type {
  BreakModelKind,
  Hyperparameter,
  Settings,
} from '../../game/grouping/break-models/break-model';
import { BREAK_MODELS } from '../../game/grouping/break-models/break-models';
import { oneIn } from '../../game/grouping/break-models/hyperparameters';
import { LUNA, LUNA_DEFAULTS } from '../../game/grouping/break-models/luna';
import { MERCURY, MERCURY_DEFAULTS } from '../../game/grouping/break-models/mercury';
import { GroupingSettingsPanel, nameOf, rowsOf } from './grouping-settings-panel';
import { PLAY_WITH_MERCURY } from '../../../testing/game-break-model';

describe('GroupingSettingsPanel', () => {
  beforeEach(() => {
    installDialogs();
    installPopovers();
  });
  afterEach(() => {
    uninstallDialogs();
    uninstallPopovers();
  });

  let copied: string[];

  async function setUp(): Promise<{ host: HTMLElement; detect: () => void }> {
    copied = [];
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
    const fixture = TestBed.createComponent(GroupingSettingsPanel);
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

  it('scrolls the row of tabs to show the whole of the tab picked', async () => {
    const { host } = await setUp();
    const row = host.querySelector<HTMLElement>('.tabs');
    const tabs = Array.from(host.querySelectorAll<HTMLElement>('[role="tab"]'));
    const last = tabs.at(-1);
    if (row === null || last === undefined) {
      throw new Error('No tabs');
    }
    // A row 200 pixels wide, its last tab 30 pixels past its right edge.
    row.getBoundingClientRect = () => new DOMRect(0, 0, 200, 40);
    last.getBoundingClientRect = () => new DOMRect(170, 0, 60, 40);
    last.click();

    expect(row.scrollLeft).toBe(30);
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
      'button[aria-label="Pin the prior baseline when fitting"]',
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
      host.querySelector<HTMLButtonElement>('button[aria-label="Back to the game\'s window"]');

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

    host.querySelector<HTMLButtonElement>('button[aria-label="About Recency decay"]')?.click();
    detect();

    expect(dialog?.open).toBe(true);
    expect(dialog?.querySelector('h2')?.textContent).toBe('Recency decay');
    expect(dialog?.textContent).toContain('Why this way.');
    buttonLabelled(host, 'Close').click();
    detect();

    expect(dialog?.open).toBe(false);
    expect(dialog?.querySelector('h2')).toBeNull();
  });

  it('brings back the game’s settings', async () => {
    const { host, detect } = await setUp();
    const reset = buttonLabelled(host, "Back to the Game's Settings");

    expect(reset.disabled).toBe(true);
    move(slider(host, 'window'), 11);
    detect();
    expect(reset.disabled).toBe(false);
    reset.click();
    detect();

    expect(TestBed.inject(Tweaks).values().grouping).toBeUndefined();
    expect(slider(host, 'window').value).toBe('21');
  });

  it('keeps the tuned settings, and none once they are all back to their defaults', async () => {
    const { host } = await setUp();
    const tweaks = TestBed.inject(Tweaks);

    move(slider(host, 'window'), 11);
    expect(tweaks.values().grouping).toEqual({ mercury: { ...MERCURY_DEFAULTS, window: 11 } });
    move(slider(host, 'window'), 21);
    expect(tweaks.values().grouping).toBeUndefined();
  });

  it('copies the values of the settings', async () => {
    const { host, detect } = await setUp();

    move(slider(host, 'level'), 0.95);
    detect();
    buttonLabelled(host, 'Copy Hyperparameter Values').click();
    await vi.waitFor(() => {
      expect(copied).toEqual([groupingText(MERCURY, { ...MERCURY_DEFAULTS, level: 0.95 })]);
    });
  });

  it('shows the break model picked, and switches to another one', async () => {
    const { host, detect } = await setUp();
    const switches = (): HTMLButtonElement[] =>
      Array.from(host.querySelectorAll('button')).filter((button) =>
        button.textContent.trim().startsWith('Model:'),
      );
    const labels = (): string[] =>
      switches().map((button) => button.firstChild?.textContent?.trim() ?? '');
    /** The switches' labels with this model picked: it first, then the others, in their order. */
    const expected = (picked: BreakModelKind): string[] => [
      `Model: ${picked.label} Is Selected`,
      ...BREAK_MODELS.filter((kind) => kind !== picked).map(
        (kind) => `Model: Switch to ${kind.label}`,
      ),
    ];
    expect(labels()).toEqual(expected(MERCURY));
    expect(switches()[0]?.disabled).toBe(true);

    switches()[BREAK_MODELS.indexOf(LUNA)]?.click();
    await vi.waitFor(() => {
      expect(TestBed.inject(Tweaks).breakModelKind()).toBe(LUNA);
    });
    detect();

    expect(labels()).toEqual(expected(LUNA));
  });

  describe('copying from another model', () => {
    /** Tunes Mercury's window and recency decay, then picks Luna, which has them too. */
    async function onLuna(): Promise<{ host: HTMLElement; detect: () => void }> {
      const panel = await setUp();
      move(slider(panel.host, 'window'), 11);
      move(slider(panel.host, 'recencyDecay'), 0.8);
      await TestBed.inject(Tweaks).setBreakModel(LUNA);
      panel.detect();
      return panel;
    }

    it('copies all the hyperparameters another model shares with the one picked', async () => {
      const { host } = await onLuna();
      move(slider(host, 'pauseMargin'), 1.5);

      buttonLabelled(host, 'Copy Shared Hyperparameters From Mercury').click();

      expect(settings()).toEqual({
        ...LUNA_DEFAULTS,
        window: 11,
        recencyDecay: 0.8,
        pauseMargin: 1.5,
      });
      expect(buttonLabelled(host, 'Copy Shared Hyperparameters From Venus')).toBeDefined();
    });

    it('copies one hyperparameter from the model picked in its menu', async () => {
      const { host, detect } = await onLuna();
      const copy = host.querySelector<HTMLButtonElement>(
        '[aria-label="Copy the window from another model"]',
      );
      copy?.click();
      detect();

      buttonLabelled(host, 'From Mercury').click();

      expect(settings()).toEqual({ ...LUNA_DEFAULTS, window: 11 });
      expect(host.querySelector('[aria-label="Copy the pause margin from another model"]')).toBe(
        null,
      );
    });
  });
});
