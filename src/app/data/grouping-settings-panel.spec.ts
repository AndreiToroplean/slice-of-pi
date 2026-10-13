import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { installDialogs, uninstallDialogs } from '../../testing/fake-dialogs';
import { WRITE_CLIPBOARD } from '../developer/copy-values';
import { DeveloperMode } from '../developer/developer-mode';
import { groupingText, Tweaks } from '../developer/tweaks';
import { INDEXED_DB, IS_PREVIEW } from '../runs/run-store';
import { BreakSettings, DEFAULT_BREAK_SETTINGS } from '../timing/break-model';
import { CONTROLS, GroupingSettingsPanel, oneIn } from './grouping-settings-panel';

describe('GroupingSettingsPanel', () => {
  beforeEach(installDialogs);
  afterEach(uninstallDialogs);

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
      expect(copied).toEqual([groupingText({ ...DEFAULT_BREAK_SETTINGS, level: 0.95 })]);
    });
  });
});
