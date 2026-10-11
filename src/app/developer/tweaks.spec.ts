import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { PALETTE } from '../place-colors/place-colors';
import { INDEXED_DB, IS_PREVIEW, RunStore } from '../runs/run-store';
import { backgroundsFrom, SEASON_BACKGROUNDS, SEASON_COLOR_SPACE } from '../seasons/seasons';
import { DEFAULT_TIMING_SETTINGS } from '../timing/timing-model';
import { DeveloperMode } from './developer-mode';
import {
  groupingText,
  paletteText,
  parseTweaks,
  SEASON_STARTS,
  seasonsText,
  Tweaks,
  TWEAKS,
  TWEAKS_FORMAT,
} from './tweaks';

describe('Tweaks', () => {
  let indexedDb: IDBFactory;
  const palette = PALETTE.map((color, i) => (i === 3 ? '#123456' : color));
  const seasons = { ...SEASON_STARTS, autumn: ['#000000', '#ffffff'] as const };
  const grouping = { ...DEFAULT_TIMING_SETTINGS, halfLife: 2 ** 4.5 };

  beforeEach(() => {
    indexedDb = new IDBFactory();
  });

  async function load(): Promise<Tweaks> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: IS_PREVIEW, useValue: false },
        { provide: INDEXED_DB, useValue: indexedDb },
      ],
    });
    const tweaks = TestBed.inject(Tweaks);
    await tweaks.loaded;
    await TestBed.inject(DeveloperMode).loaded;
    return tweaks;
  }

  it("uses the game's own values at first", async () => {
    const tweaks = await load();
    await TestBed.inject(DeveloperMode).set(true);

    expect(tweaks.values()).toEqual({});
    expect(tweaks.palette()).toBe(PALETTE);
    expect(tweaks.seasonBackgrounds()).toBe(SEASON_BACKGROUNDS);
    expect(tweaks.colorSpace()).toBe(SEASON_COLOR_SPACE);
  });

  it('applies the tuned values only while developer mode is on', async () => {
    const tweaks = await load();
    await tweaks.setPalette(palette);
    await tweaks.setSeasons(seasons);
    await tweaks.setColorSpace('oklch');

    expect(tweaks.palette()).toBe(PALETTE);
    expect(tweaks.seasonBackgrounds()).toBe(SEASON_BACKGROUNDS);
    expect(tweaks.colorSpace()).toBe(SEASON_COLOR_SPACE);

    await TestBed.inject(DeveloperMode).set(true);
    expect(tweaks.palette()).toEqual(palette);
    expect(tweaks.seasonBackgrounds()).toEqual(backgroundsFrom(seasons));
    expect(tweaks.colorSpace()).toBe('oklch');
  });

  it('keeps the tuned values for the next visits, and brings back the game’s on reset', async () => {
    const first = await load();
    await first.setPalette(palette);
    await first.setSeasons(seasons);
    await first.setColorSpace('hsl');

    const next = await load();
    expect(next.values()).toEqual({ palette, seasons, colorSpace: 'hsl' });

    await next.setPalette(undefined);
    await next.setColorSpace(undefined);
    expect((await load()).values()).toEqual({ seasons });
  });

  it('keeps a change made before the stored tweaks were read', async () => {
    await (await load()).setPalette(palette);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: INDEXED_DB, useValue: indexedDb }] });
    const tweaks = TestBed.inject(Tweaks);

    await tweaks.setSeasons(seasons);
    await tweaks.loaded;

    expect(tweaks.values()).toEqual({ seasons });
  });

  it('applies the tuned grouping settings only while developer mode is on, and keeps them', async () => {
    const tweaks = await load();
    await tweaks.setGrouping(grouping);

    expect(tweaks.grouping()).toBe(DEFAULT_TIMING_SETTINGS);
    await TestBed.inject(DeveloperMode).set(true);
    expect(tweaks.grouping()).toEqual(grouping);
    expect((await load()).values()).toEqual({ grouping });
  });

  it('reads the stored tweaks again once something else changed them', async () => {
    const tweaks = await load();
    await TestBed.inject(RunStore).saveSetting(TWEAKS, { format: TWEAKS_FORMAT, grouping });

    await tweaks.reload();

    expect(tweaks.values()).toEqual({ grouping });
  });

  describe('as text', () => {
    it('lists the key colors, saying when they are the game’s own', () => {
      expect(paletteText(PALETTE).split('\n')[0]).toBe(
        "Key colors (PALETTE in place-colors.ts), keys 0 to 9, the game's own:",
      );
      expect(paletteText(palette)).toBe(
        [
          'Key colors (PALETTE in place-colors.ts), keys 0 to 9:',
          ...palette.map((color, i) => `  ${String(i)}: ${color}`),
        ].join('\n'),
      );
    });

    it("lists every season's colors and their color space, marking those that changed", () => {
      expect(seasonsText(seasons, SEASON_COLOR_SPACE)).toBe(
        [
          'Season colors (early colors in SEASON_BACKGROUNDS in seasons.ts), top then bottom:',
          `  spring: ${SEASON_STARTS.spring[0]}, ${SEASON_STARTS.spring[1]}`,
          `  summer: ${SEASON_STARTS.summer[0]}, ${SEASON_STARTS.summer[1]}`,
          '  autumn: #000000, #ffffff (changed)',
          `  winter: ${SEASON_STARTS.winter[0]}, ${SEASON_STARTS.winter[1]}`,
          'Blended in sRGB (SEASON_COLOR_SPACE in seasons.ts)',
        ].join('\n'),
      );
      expect(seasonsText(SEASON_STARTS, 'oklch').split('\n').at(-1)).toBe(
        'Blended in OKLCH (SEASON_COLOR_SPACE in seasons.ts) (changed)',
      );
    });
  });

  it('lists the grouping settings, marking those that changed', () => {
    expect(groupingText(grouping)).toBe(
      [
        'Grouping settings (DEFAULT_TIMING_SETTINGS in timing-model.ts):',
        '  neighborhood: 4',
        '  pauseMargin: 0.8',
        '  minimumPause: 1.35',
        '  fullTrustUnevenness: 0.6',
        '  halfLife: 22.63 (changed)',
        '  evidenceNeeded: 1.2',
        '  hintConfidence: 0.45',
      ].join('\n'),
    );
  });

  it('leaves out stored grouping settings that are missing one or would divide by 0', () => {
    expect(parseTweaks({ format: TWEAKS_FORMAT, grouping })).toEqual({ grouping });
    expect(parseTweaks({ format: TWEAKS_FORMAT, grouping: { ...grouping, halfLife: 0 } })).toEqual(
      {},
    );
    expect(
      parseTweaks({ format: TWEAKS_FORMAT, grouping: { ...grouping, neighborhood: undefined } }),
    ).toEqual({});
  });

  it('reads the tweaks stored in a format it knows, leaving out what is not valid', async () => {
    expect(parseTweaks({ format: TWEAKS_FORMAT, palette, seasons, colorSpace: 'oklab' })).toEqual({
      palette,
      seasons,
      colorSpace: 'oklab',
    });
    expect(parseTweaks({ format: TWEAKS_FORMAT + 1, palette })).toEqual({});
    expect(
      parseTweaks({
        format: TWEAKS_FORMAT,
        palette: ['#fff'],
        seasons: { spring: [] },
        colorSpace: 'cmyk',
      }),
    ).toEqual({});
    expect(parseTweaks(null)).toEqual({});

    const store = (await load(), TestBed.inject(RunStore));
    await store.saveSetting(TWEAKS, { format: TWEAKS_FORMAT, palette });
    expect((await load()).values()).toEqual({ palette });
  });
});
