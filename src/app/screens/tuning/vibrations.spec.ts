import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { VIBRATE } from '../../feedback/vibrator';
import { durationAt, VIBRATION_PATTERNS } from '../../feedback/vibrations';
import { INDEXED_DB } from '../../player-data/run-store';
import { VibrationSetting } from '../../player-data/vibration-setting';
import { Vibrations } from './vibrations';

describe('Vibrations', () => {
  let vibrated: (number | number[])[];

  beforeEach(() => {
    vibrated = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: INDEXED_DB, useValue: undefined },
        {
          provide: VIBRATE,
          useValue: (pattern: number | number[]) => {
            vibrated.push(pattern);
          },
        },
      ],
    });
  });

  async function setUp(): Promise<{ host: HTMLElement; stable: () => Promise<void> }> {
    await TestBed.inject(DeveloperMode).set(true);
    const fixture = TestBed.createComponent(Vibrations);
    await fixture.whenStable();
    return { host: fixture.nativeElement as HTMLElement, stable: () => fixture.whenStable() };
  }

  function panel(host: HTMLElement, name: string): HTMLElement {
    const found = Array.from(host.querySelectorAll<HTMLElement>('section')).find(
      (section) => section.querySelector('h2')?.textContent.trim() === name,
    );
    if (found === undefined) {
      throw new Error(`No ${name}`);
    }
    return found;
  }

  /** The steps of a vibration's pattern, as shown, pauses in brackets. */
  function steps(host: HTMLElement, name: string): string[] {
    return Array.from(panel(host, name).querySelectorAll('.step'), (step) =>
      step.classList.contains('pause') ? `(${step.textContent.trim()})` : step.textContent.trim(),
    );
  }

  function button(host: HTMLElement, name: string, label: string): HTMLButtonElement {
    const found = panel(host, name).querySelector<HTMLButtonElement>(
      `button[title="${label}"], button[aria-label="${label}"]`,
    );
    if (found === null) {
      throw new Error(`No ${label} in ${name}`);
    }
    return found;
  }

  async function slide(
    host: HTMLElement,
    value: number,
    stable: () => Promise<void>,
  ): Promise<void> {
    const input = host.querySelector<HTMLInputElement>('input[type="range"]');
    if (input === null) {
      throw new Error('No slider');
    }
    input.value = String(value);
    input.dispatchEvent(new Event('input'));
    await stable();
  }

  function sliderLabel(host: HTMLElement): string {
    return host.querySelector('.slider .label')?.textContent.replace(/\s+/g, ' ').trim() ?? '';
  }

  it("shows each vibration's pattern, buzzes and pauses in order", async () => {
    const { host } = await setUp();

    expect(steps(host, 'Play')).toEqual(
      VIBRATION_PATTERNS.play.map((step, i) => (i % 2 === 0 ? String(step) : `(${String(step)})`)),
    );
    expect(steps(host, 'Digit')).toEqual([String(VIBRATION_PATTERNS.digit[0])]);
    expect(host.querySelectorAll('section')).toHaveLength(Object.keys(VIBRATION_PATTERNS).length);
  });

  it('sets the selected step on the slider, finer over the short durations', async () => {
    const { host, stable } = await setUp();
    panel(host, 'Mistake').querySelectorAll<HTMLButtonElement>('.step')[1]?.click();
    await stable();
    expect(sliderLabel(host)).toBe(`Mistake, pause 1 ${String(VIBRATION_PATTERNS.mistake[1])} ms`);

    await slide(host, 500, stable);

    expect(steps(host, 'Mistake')[1]).toBe(`(${String(durationAt(0.5))})`);
    expect(TestBed.inject(Tweaks).values().vibrations?.mistake?.[1]).toBe(durationAt(0.5));
  });

  it('adds a pause after a buzz, and a buzz like the last after a pause, selecting each', async () => {
    const { host, stable } = await setUp();

    const buzz = String(VIBRATION_PATTERNS.digit[0]);

    button(host, 'Digit', 'Add a Step').click();
    await stable();
    expect(steps(host, 'Digit')).toEqual([buzz, '(50)']);
    expect(sliderLabel(host)).toBe('Digit, pause 1 50 ms');

    button(host, 'Digit', 'Add a Step').click();
    await stable();
    expect(steps(host, 'Digit')).toEqual([buzz, '(50)', buzz]);
    expect(sliderLabel(host)).toBe(`Digit, buzz 2 ${buzz} ms`);
  });

  it('removes the last step, never the only one, moving the selection off it', async () => {
    await TestBed.inject(Tweaks).setVibration('play', [25, 70, 45]);
    const { host, stable } = await setUp();
    panel(host, 'Play').querySelectorAll<HTMLButtonElement>('.step')[2]?.click();
    await stable();

    button(host, 'Play', 'Remove the Last Step').click();
    await stable();
    expect(steps(host, 'Play')).toEqual(['25', '(70)']);
    expect(sliderLabel(host)).toBe('Play, pause 1 70 ms');

    button(host, 'Play', 'Remove the Last Step').click();
    await stable();
    expect(steps(host, 'Play')).toEqual(['25']);
    expect(button(host, 'Play', 'Remove the Last Step').disabled).toBe(true);
  });

  it('tries a pattern, even with vibration turned off', async () => {
    await TestBed.inject(VibrationSetting).set(false);
    const { host } = await setUp();

    button(host, 'Mistake', 'Try Mistake').click();

    expect(vibrated).toEqual([[...VIBRATION_PATTERNS.mistake]]);
  });

  it("brings back a vibration's own pattern, or all of them", async () => {
    const { host, stable } = await setUp();
    expect(button(host, 'Digit', 'Back to Default').disabled).toBe(true);
    button(host, 'Digit', 'Add a Step').click();
    button(host, 'Pluck', 'Add a Step').click();
    await stable();

    button(host, 'Digit', 'Back to Default').click();
    await stable();
    expect(steps(host, 'Digit')).toEqual(VIBRATION_PATTERNS.digit.map(String));
    expect(TestBed.inject(Tweaks).values().vibrations).toEqual({
      pluck: [...VIBRATION_PATTERNS.pluck, 50],
    });

    host.querySelector<HTMLButtonElement>('button[pageAction]')?.click();
    await stable();
    expect(steps(host, 'Pluck')).toEqual(VIBRATION_PATTERNS.pluck.map(String));
    expect(TestBed.inject(Tweaks).values()).toEqual({});
  });

  it('starts from the patterns tuned', async () => {
    await TestBed.inject(Tweaks).setVibration('landing', [5, 5, 5]);
    const { host } = await setUp();

    expect(steps(host, 'Landing')).toEqual(['5', '(5)', '5']);
  });
});
