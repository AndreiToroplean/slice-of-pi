import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Background } from '../background/background';
import { PALETTE } from '../place-colors/place-colors';
import { INDEXED_DB } from '../runs/run-store';
import { hexToHsl, hslToHex } from './color-math';
import { KeyColors } from './key-colors';
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

  /** The key colors down the start of the grid's rows, as shown. */
  function rows(host: HTMLElement): string[] {
    return Array.from(host.querySelectorAll<HTMLElement>('button.head'), (head) =>
      head.style.getPropertyValue('--place-color'),
    );
  }

  function key(host: HTMLElement, name: string): HTMLButtonElement {
    const button = host.querySelector<HTMLButtonElement>(`button.head[aria-label="${name}"]`);
    if (button === null) {
      throw new Error(`No ${name}`);
    }
    return button;
  }

  async function slide(
    host: HTMLElement,
    name: string,
    channel: string,
    value: number,
    stable: () => Promise<void>,
  ): Promise<void> {
    const input = host.querySelector<HTMLInputElement>(`input[aria-label="${name} ${channel}"]`);
    if (input === null) {
      throw new Error(`No ${channel} slider for ${name}`);
    }
    input.value = String(value);
    input.dispatchEvent(new Event('input'));
    await stable();
  }

  it("draws every pair of the game's colors, with a key to select at the start of each row", async () => {
    const { host } = await setUp();

    expect(rows(host)).toEqual(PALETTE);
    expect(host.querySelectorAll('.grid .pair')).toHaveLength(100);
    expect(host.querySelectorAll('.grid .pair.close')).toHaveLength(0);
  });

  it('starts with key 0 in the color picker, and selects another key', async () => {
    const { host, stable } = await setUp();
    expect(host.querySelector('app-color-picker .name')?.textContent).toBe('Key 0, red');
    expect(key(host, 'Key 0, red').getAttribute('aria-pressed')).toBe('true');

    key(host, 'Key 6, blue').click();
    await stable();

    expect(host.querySelector('app-color-picker .hex')?.textContent).toBe(PALETTE[6]);
    expect(key(host, 'Key 6, blue').getAttribute('aria-pressed')).toBe('true');
    expect(key(host, 'Key 0, red').getAttribute('aria-pressed')).toBe('false');
  });

  it('tunes the selected key, keeping the tuned palette, then brings back the game’s', async () => {
    const { host, stable } = await setUp();
    key(host, 'Key 3, lime').click();
    await stable();

    await slide(host, 'Key 3, lime', 'hue', 200, stable);

    const tuned = hslToHex({ ...hexToHsl(PALETTE[3]), hue: 200 });
    expect(rows(host)[3]).toBe(tuned);
    expect(TestBed.inject(Tweaks).values().palette?.[3]).toBe(tuned);

    const reset = Array.from(host.querySelectorAll('button')).find((button) =>
      button.textContent.includes("Back to the game's colors"),
    );
    reset?.click();
    await stable();

    expect(rows(host)).toEqual(PALETTE);
    expect(TestBed.inject(Tweaks).values()).toEqual({});
    expect(reset?.disabled).toBe(true);
  });

  it('outlines pairs that are easy to mix up', async () => {
    const { host, stable } = await setUp();
    key(host, 'Key 7, violet').click();
    await stable();

    // Violet onto blue.
    const blue = hexToHsl(PALETTE[6]);
    await slide(host, 'Key 7, violet', 'hue', Math.round(blue.hue), stable);
    await slide(host, 'Key 7, violet', 'saturation', Math.round(blue.saturation), stable);
    await slide(host, 'Key 7, violet', 'lightness', Math.round(blue.lightness), stable);

    // Blue then violet, and violet then blue.
    expect(host.querySelectorAll('.grid .pair.close')).toHaveLength(2);
  });

  it('averages the selected key between the keys on either side', async () => {
    const { host, stable } = await setUp();
    key(host, 'Key 0, red').click();
    await stable();

    const swatches = Array.from(
      host.querySelectorAll<HTMLElement>('button.average .swatch'),
      (swatch) => swatch.style.background,
    );
    expect(swatches).toHaveLength(2);
    host.querySelector<HTMLButtonElement>('button.average')?.click();
    await stable();

    expect(rows(host)[0]).not.toBe(PALETTE[0]);
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
