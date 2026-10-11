import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Background } from '../background/background';
import { INDEXED_DB } from '../runs/run-store';
import {
  backgroundsFrom,
  SEASON_BACKGROUNDS,
  SEASON_COLOR_SPACE,
  seasonAt,
} from '../seasons/seasons';
import { DeveloperMode } from './developer-mode';
import { hexToHsl, hslToHex } from '../colors/color-spaces';
import { averageHsl } from './color-math';
import { SeasonColors } from './season-colors';
import { SEASON_STARTS, Tweaks } from './tweaks';

describe('SeasonColors', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: INDEXED_DB, useValue: undefined }],
    });
  });

  async function setUp(): Promise<{ host: HTMLElement; stable: () => Promise<void> }> {
    const fixture = TestBed.createComponent(SeasonColors);
    await fixture.whenStable();
    return { host: fixture.nativeElement as HTMLElement, stable: () => fixture.whenStable() };
  }

  function swatch(host: HTMLElement, label: string): HTMLButtonElement {
    const element = host.querySelector<HTMLButtonElement>(`button.swatch[aria-label="${label}"]`);
    if (element === null) {
      throw new Error(`No swatch ${label}`);
    }
    return element;
  }

  function slider(host: HTMLElement): HTMLInputElement {
    const element = host.querySelector<HTMLInputElement>('label.place input[type="range"]');
    if (element === null) {
      throw new Error('No slider');
    }
    return element;
  }

  async function set(
    element: HTMLInputElement,
    value: string,
    stable: () => Promise<void>,
  ): Promise<void> {
    element.value = value;
    element.dispatchEvent(new Event('input'));
    await stable();
  }

  it('has a top and a bottom color for each season, starting with the top of spring in the picker', async () => {
    const { host } = await setUp();

    expect(host.querySelectorAll('button.swatch')).toHaveLength(8);
    expect(swatch(host, 'Winter bottom').style.background).toBe('rgb(70, 89, 143)');
    expect(swatch(host, 'Spring top').getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('app-color-picker .name')?.textContent).toBe('Spring top');
    expect(host.querySelector('app-color-picker .hex')?.textContent).toBe(SEASON_STARTS.spring[0]);
  });

  it('moves the background through the year as typing digits does', async () => {
    const { host, stable } = await setUp();
    const background = TestBed.inject(Background).colors;
    expect(background()).toEqual(seasonAt(0).background);
    const range = slider(host);
    expect(range.max).toBe('100');

    await set(range, '60', stable);

    expect(background()).toEqual(seasonAt(60).background);
    expect(host.querySelector('app-season-header .name')?.textContent.trim()).toBe('Autumn');
  });

  it('tunes the selected color, keeping it, and shows it in the background, then brings back the game’s', async () => {
    const { host, stable } = await setUp();
    const background = TestBed.inject(Background).colors;
    await set(slider(host), '30', stable);
    swatch(host, 'Summer bottom').click();
    await stable();
    expect(host.querySelector('app-color-picker .name')?.textContent).toBe('Summer bottom');

    const lightness = host.querySelector<HTMLInputElement>(
      'input[aria-label="Summer bottom lightness"]',
    );
    if (lightness === null) {
      throw new Error('No lightness slider');
    }
    await set(lightness, '0', stable);

    const tuned = { ...SEASON_STARTS, summer: [SEASON_STARTS.summer[0], '#000000'] as const };
    expect(TestBed.inject(Tweaks).values().seasons).toEqual(tuned);
    expect(background()).toEqual(seasonAt(30, backgroundsFrom(tuned)).background);

    const reset = Array.from(host.querySelectorAll('button')).find((button) =>
      button.textContent.includes("Back to the game's colors"),
    );
    reset?.click();
    await stable();

    expect(TestBed.inject(Tweaks).values()).toEqual({});
    expect(background()).toEqual(seasonAt(30).background);
    expect(host.querySelector('app-color-picker .hex')?.textContent).toBe(SEASON_STARTS.summer[1]);
  });

  it('blends the colors in the color space selected, and brings back the game’s on reset', async () => {
    await TestBed.inject(DeveloperMode).set(true);
    const { host, stable } = await setUp();
    const background = TestBed.inject(Background).colors;
    await set(slider(host), '72', stable);
    const select = host.querySelector<HTMLSelectElement>('label.space select');
    if (select === null) {
      throw new Error('No color space');
    }
    expect(select.value).toBe(SEASON_COLOR_SPACE);
    expect(Array.from(select.options, (option) => option.textContent.trim())).toEqual([
      'sRGB (the game’s)',
      'OKLab',
      'HSL',
      'OKLCH',
    ]);

    select.value = 'oklch';
    select.dispatchEvent(new Event('change'));
    await stable();

    expect(TestBed.inject(Tweaks).values()).toEqual({ colorSpace: 'oklch' });
    expect(background()).toEqual(seasonAt(72, SEASON_BACKGROUNDS, 'oklch').background);

    host.querySelector<HTMLButtonElement>('app-page-header button.pill')?.click();
    await stable();

    expect(TestBed.inject(Tweaks).values()).toEqual({});
    expect(background()).toEqual(seasonAt(72).background);
    expect(select.value).toBe(SEASON_COLOR_SPACE);
  });

  it('averages the selected color between the same end of the seasons on either side', async () => {
    const { host, stable } = await setUp();
    swatch(host, 'Autumn top').click();
    await stable();

    host.querySelector<HTMLButtonElement>('button.average')?.click();
    await stable();

    const expected = hslToHex(
      averageHsl(hexToHsl(SEASON_STARTS.summer[0]), hexToHsl(SEASON_STARTS.winter[0])),
    );
    expect(TestBed.inject(Tweaks).values().seasons?.autumn[0]).toBe(expected);
  });

  it('copies its colors from a button at its bottom, with the reset in its top bar', async () => {
    const { host } = await setUp();

    expect(host.querySelector(':scope > app-copy-values button')?.textContent.trim()).toBe(
      'Copy hyperparameter values',
    );
    expect(host.querySelector('app-page-header button.pill')?.textContent.trim()).toBe(
      "Back to the game's colors",
    );
  });

  it('starts on the colors tuned before', async () => {
    const tuned = { ...SEASON_STARTS, spring: ['#000000', '#ffffff'] as const };
    await TestBed.inject(Tweaks).setSeasons(tuned);

    const { host } = await setUp();

    expect(host.querySelector('app-color-picker .hex')?.textContent).toBe('#000000');
    expect(TestBed.inject(Background).colors()).toEqual(['#000000', '#ffffff']);
  });
});
