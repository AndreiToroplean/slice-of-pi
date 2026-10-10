import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Background } from '../background/background';
import { PALETTE } from '../place-colors/place-colors';
import { INDEXED_DB } from '../runs/run-store';
import { hexToOklch, oklchToHex } from './color-math';
import { COLOR_NAMES, contrastNeeded, KeyColors } from './key-colors';
import { SEASON_STARTS, Tweaks } from './tweaks';

describe('KeyColors', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: INDEXED_DB, useValue: undefined }],
    });
  });

  async function setUp(): Promise<{ host: HTMLElement; stable: () => Promise<void> }> {
    const fixture = TestBed.createComponent(KeyColors);
    await fixture.whenStable();
    return { host: fixture.nativeElement as HTMLElement, stable: () => fixture.whenStable() };
  }

  function swatches(host: HTMLElement): string[] {
    return Array.from(host.querySelectorAll<HTMLElement>('.swatch'), (swatch) =>
      swatch.style.getPropertyValue('--place-color'),
    );
  }

  function slider(host: HTMLElement, label: string): HTMLInputElement {
    const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
    if (input === null) {
      throw new Error(`No slider ${label}`);
    }
    return input;
  }

  it("starts on the game's colors, one row of sliders each", async () => {
    const { host } = await setUp();

    expect(swatches(host)).toEqual(PALETTE);
    expect(host.querySelectorAll('input[type="range"]')).toHaveLength(30);
    expect(Number(slider(host, 'teal hue').value)).toBeCloseTo(hexToOklch(PALETTE[5])[2], 0);
  });

  it('starts on the colors tuned before', async () => {
    const tuned = PALETTE.map((color, i) => (i === 0 ? '#aa2222' : color));
    await TestBed.inject(Tweaks).setPalette(tuned);

    const { host } = await setUp();

    expect(swatches(host)).toEqual(tuned);
  });

  it('tunes a color, keeping the tuned palette, then brings back the game’s', async () => {
    const { host, stable } = await setUp();
    const hue = slider(host, 'red hue');
    hue.value = '200';
    hue.dispatchEvent(new Event('input'));
    await stable();

    const [lightness, chroma] = hexToOklch(PALETTE[0]);
    const tuned = oklchToHex([lightness, chroma, 200]);
    expect(swatches(host)[0]).toBe(tuned);
    expect(TestBed.inject(Tweaks).values().palette?.[0]).toBe(tuned);
    expect(host.querySelector('.meta .hex')?.textContent).toBe(tuned);

    const reset = Array.from(host.querySelectorAll('button')).find((button) =>
      button.textContent.includes("Back to the game's colors"),
    );
    expect(reset?.disabled).toBe(false);
    reset?.click();
    await stable();

    expect(swatches(host)).toEqual(PALETTE);
    expect(TestBed.inject(Tweaks).values()).toEqual({});
    expect(reset?.disabled).toBe(true);
  });

  it('shows the closest pairs first, and flags those easy to mix up', async () => {
    const { host, stable } = await setUp();
    const pairs = (): string[] =>
      Array.from(host.querySelectorAll('.pair .verdict'), (verdict) =>
        verdict.textContent.replace(/\s+/g, ' ').trim(),
      );
    expect(pairs()).toHaveLength(6);
    expect(pairs()[0]).toMatch(/^blue \/ violet · \d+\.\d$/);

    // Violet's hue onto blue's.
    const hue = slider(host, 'violet hue');
    hue.value = String(hexToOklch(PALETTE[6])[2]);
    hue.dispatchEvent(new Event('input'));
    await stable();

    expect(pairs()[0]).toMatch(/^blue \/ violet · \d+\.\d · (almost the same|easy to mix up)$/);
    expect(host.querySelectorAll('.pairs .word.close')).toHaveLength(2);
  });

  it('says how well white digits read on each color', async () => {
    const { host } = await setUp();

    const metas = Array.from(host.querySelectorAll('.meta'), (meta) =>
      meta.textContent.replace(/\s+/g, ' ').trim(),
    );
    expect(metas[0]).toMatch(/^#de3e2d red white digits 4\.3:1 nearest: 1 orange, ΔE \d+\.\d$/);
    expect(COLOR_NAMES).toHaveLength(PALETTE.length);
    expect(contrastNeeded(2)).toBeLessThan(contrastNeeded(0));
  });

  it('draws every pair, and the first 100 decimals in words of 5 after the lead', async () => {
    const { host } = await setUp();

    expect(host.querySelectorAll('.pairs .word')).toHaveLength(100);
    const words = Array.from(host.querySelectorAll('.words .word'), (word) =>
      word.textContent.replace(/\s/g, ''),
    );
    expect(words).toHaveLength(21);
    expect(words.slice(0, 3)).toEqual(['π=3.', '14159', '26535']);
  });

  it('copies its colors from a button in its top bar', async () => {
    const { host } = await setUp();

    expect(host.querySelector('app-page-header app-copy-values button')?.textContent.trim()).toBe(
      'Copy hyperparameter values',
    );
  });

  it("shows a season's starting background behind the page", async () => {
    const { host, stable } = await setUp();
    const background = TestBed.inject(Background).colors;
    expect(background()).toEqual(SEASON_STARTS.spring);

    const winter = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="radio"]')).find(
      (button) => button.textContent.trim() === 'Winter',
    );
    winter?.click();
    await stable();

    expect(background()).toEqual(SEASON_STARTS.winter);
    expect(winter?.getAttribute('aria-checked')).toBe('true');
  });
});
