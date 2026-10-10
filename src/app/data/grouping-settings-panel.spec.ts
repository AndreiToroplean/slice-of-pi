import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { installDialogs, uninstallDialogs } from '../../testing/fake-dialogs';
import { WRITE_CLIPBOARD } from '../developer/copy-values';
import { DeveloperMode } from '../developer/developer-mode';
import { groupingText, Tweaks } from '../developer/tweaks';
import { INDEXED_DB, IS_PREVIEW } from '../runs/run-store';
import { DEFAULT_TIMING_SETTINGS, TimingSettings } from '../timing/timing-model';
import { CONTROLS, GroupingSettingsPanel } from './grouping-settings-panel';

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

  function slider(host: HTMLElement, key: keyof TimingSettings): HTMLInputElement {
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

  function settings(): TimingSettings {
    return TestBed.inject(Tweaks).grouping();
  }

  it('has a labelled slider for every setting, at its default', async () => {
    const { host } = await setUp();

    expect(CONTROLS.map((control) => control.key).sort()).toEqual(
      Object.keys(DEFAULT_TIMING_SETTINGS).sort(),
    );
    for (const control of CONTROLS) {
      const input = slider(host, control.key);
      expect(host.querySelector(`label[for="setting-${control.key}"]`)?.textContent).toBe(
        control.label,
      );
      expect(Number(input.min)).toBeLessThanOrEqual(Number(input.value));
      expect(Number(input.max)).toBeGreaterThanOrEqual(Number(input.value));
    }
    expect(slider(host, 'neighborhood').value).toBe('4');
    expect(slider(host, 'neighborhood').getAttribute('aria-valuetext')).toBe('4 digits');
  });

  it('changes the setting as its slider moves, and shows its value', async () => {
    const { host, detect } = await setUp();

    move(slider(host, 'pauseMargin'), 1.5);
    detect();

    expect(settings().pauseMargin).toBe(1.5);
    expect(host.querySelector('output[for="setting-pauseMargin"]')?.textContent).toBe(
      '1.50 spreads',
    );
  });

  it('moves the half-life on a scale of powers of two, from 1 to 256 runs', async () => {
    const { host, detect } = await setUp();
    const input = slider(host, 'halfLife');

    expect(input.value).toBe('4');
    expect([input.min, input.max]).toEqual(['0', '8']);
    move(input, 5.5);
    detect();

    expect(settings().halfLife).toBeCloseTo(45.25, 2);
    expect(host.querySelector('output[for="setting-halfLife"]')?.textContent).toBe('45 runs');
  });

  it('opens the help of a setting in a dialog, and closes it', async () => {
    const { host, detect } = await setUp();
    const dialog = host.querySelector('dialog');

    host.querySelector<HTMLButtonElement>('button[aria-label="About Half-life"]')?.click();
    detect();

    expect(dialog?.open).toBe(true);
    expect(dialog?.querySelector('h2')?.textContent).toBe('Half-life');
    expect(dialog?.textContent).toContain('Why this way.');
    buttonLabelled(host, 'Close').click();
    detect();

    expect(dialog?.open).toBe(false);
    expect(dialog?.querySelector('h2')).toBeNull();
  });

  it('brings back the game’s settings', async () => {
    const { host, detect } = await setUp();
    const reset = buttonLabelled(host, "Back to the game's settings");

    expect(reset.disabled).toBe(true);
    move(slider(host, 'minimumPause'), 2);
    detect();
    expect(reset.disabled).toBe(false);
    reset.click();
    detect();

    expect(TestBed.inject(Tweaks).values().grouping).toBeUndefined();
    expect(slider(host, 'minimumPause').value).toBe('1.35');
  });

  it('keeps the tuned settings, and none once they are all back to their defaults', async () => {
    const { host } = await setUp();
    const tweaks = TestBed.inject(Tweaks);

    move(slider(host, 'minimumPause'), 2);
    expect(tweaks.values().grouping).toEqual({ ...DEFAULT_TIMING_SETTINGS, minimumPause: 2 });
    move(slider(host, 'minimumPause'), 1.35);
    expect(tweaks.values().grouping).toBeUndefined();
  });

  it('copies the values of the settings', async () => {
    const { host, detect } = await setUp();

    move(slider(host, 'pauseMargin'), 1.5);
    detect();
    buttonLabelled(host, 'Copy hyperparameter values').click();
    await vi.waitFor(() => {
      expect(copied).toEqual([groupingText({ ...DEFAULT_TIMING_SETTINGS, pauseMargin: 1.5 })]);
    });
  });
});
