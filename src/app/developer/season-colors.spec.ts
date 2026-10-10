import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Background } from '../background/background';
import { INDEXED_DB } from '../runs/run-store';
import { backgroundsFrom, seasonAt } from '../seasons/seasons';
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

  function input(host: HTMLElement, label: string): HTMLInputElement {
    const element = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
    if (element === null) {
      throw new Error(`No input ${label}`);
    }
    return element;
  }

  function slider(host: HTMLElement): HTMLInputElement {
    const element = host.querySelector<HTMLInputElement>('input[type="range"]');
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

  it("has a top and a bottom color picker for each season, on the game's colors", async () => {
    const { host } = await setUp();

    expect(host.querySelectorAll('input[type="color"]')).toHaveLength(8);
    expect(input(host, 'Spring top').value).toBe(SEASON_STARTS.spring[0]);
    expect(input(host, 'Winter bottom').value).toBe(SEASON_STARTS.winter[1]);
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

  it('tunes a color, keeping it, and shows it in the background, then brings back the game’s', async () => {
    const { host, stable } = await setUp();
    const background = TestBed.inject(Background).colors;
    await set(slider(host), '30', stable);

    await set(input(host, 'Summer bottom'), '#000000', stable);

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
    expect(input(host, 'Summer bottom').value).toBe(SEASON_STARTS.summer[1]);
  });

  it('copies its colors from a button in its top bar', async () => {
    const { host } = await setUp();

    expect(host.querySelector('app-page-header app-copy-values button')?.textContent.trim()).toBe(
      'Copy hyperparameter values',
    );
  });

  it('starts on the colors tuned before', async () => {
    const tuned = { ...SEASON_STARTS, spring: ['#000000', '#ffffff'] as const };
    await TestBed.inject(Tweaks).setSeasons(tuned);

    const { host } = await setUp();

    expect(input(host, 'Spring top').value).toBe('#000000');
    expect(TestBed.inject(Background).colors()).toEqual(['#000000', '#ffffff']);
  });
});
