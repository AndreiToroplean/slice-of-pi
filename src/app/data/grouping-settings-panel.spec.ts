import { AVERAGE_MODEL } from '../timing/average-model';
import { GROUPING_MODEL, GROUPING_MODELS } from '../timing/grouping-models';
import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { installDialogs, uninstallDialogs } from '../../testing/fake-dialogs';
import { installPopovers, uninstallPopovers } from '../../testing/fake-popovers';
import { WRITE_CLIPBOARD } from '../developer/copy-values';
import { DeveloperMode } from '../developer/developer-mode';
import { groupingText, Tweaks } from '../developer/tweaks';
import { INDEXED_DB, IS_PREVIEW } from '../runs/run-store';
import { BreakSettings, DEFAULT_BREAK_SETTINGS } from '../timing/break-model';
import { ChartGuides } from './chart-guides';
import { CONTROLS, GroupingSettingsPanel, oneIn, SETTING_TABS } from './grouping-settings-panel';

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

  function slider(host: HTMLElement, key: keyof BreakSettings): HTMLInputElement {
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

  function settings(): BreakSettings {
    return TestBed.inject(Tweaks).grouping();
  }

  it('has a labelled slider for every setting, at its default', async () => {
    const { host } = await setUp();

    expect(CONTROLS.map((control) => control.key).sort()).toEqual(
      Object.keys(DEFAULT_BREAK_SETTINGS).sort(),
    );
    for (const control of CONTROLS) {
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

  it('puts every setting in one tab, four at most to a tab', () => {
    const keys = SETTING_TABS.flatMap((tab) => tab.keys);

    expect(keys).toHaveLength(CONTROLS.length);
    expect(new Set(keys)).toEqual(new Set(CONTROLS.map((control) => control.key)));
    expect(Math.max(...SETTING_TABS.map((tab) => tab.keys.length))).toBeLessThanOrEqual(4);
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

  it('shows a setting on the charts while its checkbox is checked', async () => {
    const { host, detect } = await setUp();
    const checkbox = host.querySelector<HTMLInputElement>(
      'input[aria-label="Show prior baseline on the charts"]',
    );
    const shown = TestBed.inject(ChartGuides).shown;

    checkbox?.click();
    detect();
    expect([...shown()]).toEqual(['priorBaseline']);
    expect(checkbox?.checked).toBe(true);

    checkbox?.click();
    expect(shown().size).toBe(0);
    expect(host.querySelector('input[aria-label="Show window on the charts"]')).toBeNull();
  });

  it('changes the setting as its slider moves, and shows its value', async () => {
    const { host, detect } = await setUp();

    move(slider(host, 'level'), 0.95);
    detect();

    expect(settings().level).toBe(0.95);
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

    expect(settings()).toEqual({ ...DEFAULT_BREAK_SETTINGS, level: 0.95 });
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

  describe('with the average model', () => {
    /** The choice of a grouping model, by its label. */
    function modelChoice(host: HTMLElement, label: string): HTMLInputElement {
      const found = Array.from(host.querySelectorAll('label')).find(
        (each) => each.textContent.trim() === label,
      );
      const input = found?.querySelector<HTMLInputElement>('input[type="radio"]');
      if (input === null || input === undefined) {
        throw new Error(`No choice of the ${label} model`);
      }
      return input;
    }

    function averaging(host: HTMLElement): HTMLInputElement {
      return modelChoice(host, AVERAGE_MODEL.label);
    }

    it('takes the groups from the model picked', async () => {
      const { host, detect } = await setUp();
      const tweaks = TestBed.inject(Tweaks);
      expect(modelChoice(host, GROUPING_MODEL.label).checked).toBe(true);

      averaging(host).click();
      detect();
      expect(tweaks.groupingModel()).toBe(AVERAGE_MODEL);
      expect(averaging(host).checked).toBe(true);

      modelChoice(host, GROUPING_MODEL.label).click();
      expect(tweaks.groupingModel()).toBe(GROUPING_MODEL);
      expect(tweaks.values()).toEqual({});
    });

    it('offers every model, each with a slider for every setting it uses and no other', async () => {
      const { host, detect } = await setUp();

      for (const model of GROUPING_MODELS) {
        modelChoice(host, model.label).click();
        detect();
        const sliders = Array.from(
          host.querySelectorAll<HTMLInputElement>('input[type="range"]'),
          (input) => input.id.replace('setting-', ''),
        );
        expect(sliders.sort()).toEqual([...model.settings].sort());
      }
    });

    it('has no break threshold, which it never uses', async () => {
      const { host, detect } = await setUp();

      averaging(host).click();
      detect();

      expect(host.querySelector('#setting-breakThreshold')).toBeNull();
      expect(slider(host, 'usualThreshold')).toBeTruthy();
    });

    it('explains the settings the way it uses them', async () => {
      const { host, detect } = await setUp();
      const help = (): string => {
        host.querySelector<HTMLButtonElement>('button[aria-label="About Window"]')?.click();
        detect();
        const text = host.querySelector('dialog')?.textContent ?? '';
        buttonLabelled(host, 'Close').click();
        detect();
        return text;
      };
      const breaks = help();

      averaging(host).click();
      detect();

      expect(help()).not.toBe(breaks);
    });

    it('goes back to the break model with the game’s settings, and copies which model it is', async () => {
      const { host, detect } = await setUp();
      const tweaks = TestBed.inject(Tweaks);

      averaging(host).click();
      detect();
      buttonLabelled(host, 'Copy Hyperparameter Values').click();
      await vi.waitFor(() => {
        expect(copied).toEqual([groupingText(AVERAGE_MODEL, DEFAULT_BREAK_SETTINGS)]);
      });
      buttonLabelled(host, "Back to the Game's Settings").click();
      await vi.waitFor(() => {
        expect(tweaks.groupingModel()).toBe(GROUPING_MODEL);
      });
    });
  });

  it('keeps the tuned settings, and none once they are all back to their defaults', async () => {
    const { host } = await setUp();
    const tweaks = TestBed.inject(Tweaks);

    move(slider(host, 'window'), 11);
    expect(tweaks.values().grouping).toEqual({ ...DEFAULT_BREAK_SETTINGS, window: 11 });
    move(slider(host, 'window'), 21);
    expect(tweaks.values().grouping).toBeUndefined();
  });

  it('copies the values of the settings', async () => {
    const { host, detect } = await setUp();

    move(slider(host, 'level'), 0.95);
    detect();
    buttonLabelled(host, 'Copy Hyperparameter Values').click();
    await vi.waitFor(() => {
      expect(copied).toEqual([
        groupingText(GROUPING_MODEL, { ...DEFAULT_BREAK_SETTINGS, level: 0.95 }),
      ]);
    });
  });
});
