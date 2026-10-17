import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { PALETTE } from '../game/layers/place-colors';
import { INDEXED_DB, IS_PREVIEW, RunStore } from '../player-data/run-store';
import {
  backgroundsFrom,
  SEASON_BACKGROUNDS,
  SEASON_COLOR_SPACE,
  SEASON_TURN,
} from '../game/layers/seasons';
import { BreakSettings, DEFAULT_BREAK_SETTINGS } from '../game/grouping/break-model';
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
  const grouping = { ...DEFAULT_BREAK_SETTINGS, recencyDecay: 0.95 };

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
    expect(tweaks.seasonTurn()).toBe(SEASON_TURN);
  });

  it('applies the tuned values only while developer mode is on', async () => {
    const tweaks = await load();
    await tweaks.setPalette(palette);
    await tweaks.setSeasons(seasons);
    await tweaks.setColorSpace('hsl');
    await tweaks.setSeasonTurn(1);

    expect(tweaks.palette()).toBe(PALETTE);
    expect(tweaks.seasonTurn()).toBe(SEASON_TURN);
    expect(tweaks.seasonBackgrounds()).toBe(SEASON_BACKGROUNDS);
    expect(tweaks.colorSpace()).toBe(SEASON_COLOR_SPACE);

    await TestBed.inject(DeveloperMode).set(true);
    expect(tweaks.palette()).toEqual(palette);
    expect(tweaks.seasonBackgrounds()).toEqual(backgroundsFrom(seasons));
    expect(tweaks.colorSpace()).toBe('hsl');
    expect(tweaks.seasonTurn()).toBe(1);
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

    expect(tweaks.grouping()).toBe(DEFAULT_BREAK_SETTINGS);
    await TestBed.inject(DeveloperMode).set(true);
    expect(tweaks.grouping()).toEqual(grouping);
    expect((await load()).values()).toEqual({ grouping });
  });

  it('checks the digits unless told not to, only while developer mode is on, and keeps that', async () => {
    const tweaks = await load();
    expect(tweaks.checking()).toBe(true);

    await tweaks.setChecking(false);
    expect(tweaks.checking()).toBe(true);
    await TestBed.inject(DeveloperMode).set(true);
    expect(tweaks.checking()).toBe(false);
    expect((await load()).values()).toEqual({ checking: false });

    await TestBed.inject(Tweaks).setChecking(true);
    expect((await load()).values()).toEqual({});
  });

  it('leaves unchecked runs out of the groups unless told otherwise, only while developer mode is on', async () => {
    const tweaks = await load();
    expect(tweaks.includeUnchecked()).toBe(false);

    await tweaks.setIncludeUnchecked(true);
    expect(tweaks.includeUnchecked()).toBe(false);
    await TestBed.inject(DeveloperMode).set(true);
    expect(tweaks.includeUnchecked()).toBe(true);
    expect((await load()).values()).toEqual({ includeUnchecked: true });

    await TestBed.inject(Tweaks).setIncludeUnchecked(false);
    expect((await load()).values()).toEqual({});
  });

  it('puts the runs in another order only while developer mode is on, and keeps it until undone', async () => {
    const tweaks = await load();
    const runOrder = { ids: ['b', 'a'], line: 1 };
    expect(tweaks.runOrder()).toBeUndefined();

    await tweaks.setRunOrder(runOrder);
    expect(tweaks.runOrder()).toBeUndefined();
    await TestBed.inject(DeveloperMode).set(true);
    expect(tweaks.runOrder()).toEqual(runOrder);
    expect((await load()).values()).toEqual({ runOrder });

    await TestBed.inject(Tweaks).setRunOrder(undefined);
    expect((await load()).values()).toEqual({});
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

    it("lists every season's colors, their color space and turn, marking those that changed", () => {
      expect(seasonsText(seasons, SEASON_COLOR_SPACE, SEASON_TURN)).toBe(
        [
          'Season colors (early colors in SEASON_BACKGROUNDS in seasons.ts), top then bottom:',
          `  spring: ${SEASON_STARTS.spring[0]}, ${SEASON_STARTS.spring[1]}`,
          `  summer: ${SEASON_STARTS.summer[0]}, ${SEASON_STARTS.summer[1]}`,
          '  autumn: #000000, #ffffff (changed)',
          `  winter: ${SEASON_STARTS.winter[0]}, ${SEASON_STARTS.winter[1]}`,
          'Blended in OKLCH (SEASON_COLOR_SPACE in seasons.ts)',
          'Turning over 5 digits (SEASON_TURN in seasons.ts)',
        ].join('\n'),
      );
      expect(seasonsText(SEASON_STARTS, 'srgb', 1).split('\n').slice(-2)).toEqual([
        'Blended in sRGB (SEASON_COLOR_SPACE in seasons.ts) (changed)',
        'Turning over 1 digit (SEASON_TURN in seasons.ts) (changed)',
      ]);
    });
  });

  it('lists the grouping settings, marking those that changed', () => {
    expect(groupingText(grouping)).toBe(
      [
        'Grouping settings (DEFAULT_BREAK_SETTINGS in break-model.ts):',
        '  window: 21',
        '  recencyDecay: 0.95 (changed)',
        '  level: 0.9',
        '  priorStrength: 5',
        '  syntheticRuns: 5',
        '  syntheticDecay: 0.5',
        '  priorBaseline: 300',
        '  priorBreakShare: 0.15',
        '  priorBreakSize: 2.5',
        '  priorNormalSpread: 0.25',
        '  priorBreakSpread: 0.4',
        '  breakThreshold: 0.5',
        '  usualThreshold: 0.5',
        '  startingSlots: 5',
      ].join('\n'),
    );
  });

  it('puts back the default of each stored grouping setting that is missing or out of range', () => {
    expect(parseTweaks({ format: TWEAKS_FORMAT, grouping })).toEqual({ grouping });
    for (const wrong of [
      { window: 0 },
      { window: 2.5 },
      { recencyDecay: 0 },
      { recencyDecay: 1.1 },
      { level: -0.1 },
      { level: 1.1 },
      { level: undefined },
      { priorStrength: -1 },
      { priorBaseline: 0 },
      { syntheticRuns: 1.5 },
      { syntheticDecay: 0 },
      { priorBreakShare: 1 },
      { priorNormalSpread: 0 },
      { breakThreshold: 1 },
      { usualThreshold: 0 },
      { startingSlots: 0 },
    ]) {
      const [key] = Object.keys(wrong) as (keyof BreakSettings)[];
      expect(parseTweaks({ format: TWEAKS_FORMAT, grouping: { ...grouping, ...wrong } })).toEqual({
        grouping: {
          ...grouping,
          ...(key === undefined ? {} : { [key]: DEFAULT_BREAK_SETTINGS[key] }),
        },
      });
    }
  });

  it('keeps the grouping settings stored when others were added or dropped since', () => {
    expect(
      parseTweaks({
        format: TWEAKS_FORMAT,
        grouping: { window: 31, recencyDecay: 0.95, droppedSince: 2 },
      }),
    ).toEqual({ grouping: { ...DEFAULT_BREAK_SETTINGS, window: 31, recencyDecay: 0.95 } });
  });

  it('leaves out the settings saved for the timing model the break model replaced', () => {
    expect(
      parseTweaks({
        format: TWEAKS_FORMAT,
        grouping: {
          neighborhood: 4,
          pauseMargin: 0.8,
          minimumPause: 1.35,
          fullTrustUnevenness: 0.6,
          halfLife: 16,
          evidenceNeeded: 1.2,
          confidenceNeeded: 0.45,
        },
      }),
    ).toEqual({});
  });

  it('reads the tweaks stored in a format it knows, leaving out what is not valid', async () => {
    expect(
      parseTweaks({ format: TWEAKS_FORMAT, palette, seasons, colorSpace: 'oklab', seasonTurn: 25 }),
    ).toEqual({ palette, seasons, colorSpace: 'oklab', seasonTurn: 25 });
    expect(parseTweaks({ format: TWEAKS_FORMAT + 1, palette })).toEqual({});
    expect(parseTweaks({ palette })).toEqual({ palette });
    expect(
      parseTweaks({
        format: TWEAKS_FORMAT,
        palette: ['#fff'],
        seasons: { spring: [] },
        colorSpace: 'cmyk',
        seasonTurn: 2.5,
      }),
    ).toEqual({});
    expect(parseTweaks({ format: TWEAKS_FORMAT, checking: false })).toEqual({ checking: false });
    expect(parseTweaks({ format: TWEAKS_FORMAT, checking: true })).toEqual({});
    expect(parseTweaks({ format: TWEAKS_FORMAT, checking: 'no' })).toEqual({});
    expect(parseTweaks({ format: TWEAKS_FORMAT, includeUnchecked: true })).toEqual({
      includeUnchecked: true,
    });
    expect(parseTweaks({ format: TWEAKS_FORMAT, includeUnchecked: false })).toEqual({});
    expect(parseTweaks({ format: TWEAKS_FORMAT, runOrder: { ids: ['a'], other: 1 } })).toEqual({
      runOrder: { ids: ['a'] },
    });
    expect(parseTweaks({ format: TWEAKS_FORMAT, runOrder: { ids: ['a', 'b'], line: 2 } })).toEqual({
      runOrder: { ids: ['a', 'b'], line: 2 },
    });
    expect(parseTweaks({ format: TWEAKS_FORMAT, runOrder: { ids: ['a'], line: 2 } })).toEqual({});
    expect(parseTweaks({ format: TWEAKS_FORMAT, runOrder: { ids: ['a'], line: 0.5 } })).toEqual({});
    expect(parseTweaks({ format: TWEAKS_FORMAT, runOrder: { ids: ['a', 'a'] } })).toEqual({});
    expect(parseTweaks({ format: TWEAKS_FORMAT, runOrder: { ids: [''] } })).toEqual({});
    expect(parseTweaks({ format: TWEAKS_FORMAT, runOrder: { line: 0 } })).toEqual({});
    expect(parseTweaks({ format: TWEAKS_FORMAT, runOrder: 'a' })).toEqual({});
    expect(parseTweaks({ format: TWEAKS_FORMAT, seasonTurn: 0 })).toEqual({});
    expect(parseTweaks({ format: TWEAKS_FORMAT, seasonTurn: 26 })).toEqual({});
    expect(parseTweaks(null)).toEqual({});

    const store = (await load(), TestBed.inject(RunStore));
    await store.saveSetting(TWEAKS, { format: TWEAKS_FORMAT, palette });
    expect((await load()).values()).toEqual({ palette });
  });
});
