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
import { BreakSettings } from '../game/grouping/break-models/hyperparameters';
import { MERCURY, MERCURY_DEFAULTS } from '../game/grouping/break-models/mercury';
import { VENUS } from '../game/grouping/break-models/venus';
import { DeveloperMode } from './developer-mode';
import { parseTweaks, SEASON_STARTS, Tweaks, TWEAKS, TWEAKS_FORMAT, tweaksBackup } from './tweaks';
import { readBackup } from '../player-data/backup';
import { LAYOUT } from '../ui/layout';
import { PLAY_WITH_MERCURY } from '../../testing/game-break-model';

describe('Tweaks', () => {
  let indexedDb: IDBFactory;
  const palette = PALETTE.map((color, i) => (i === 3 ? '#123456' : color));
  const seasons = { ...SEASON_STARTS, autumn: ['#000000', '#ffffff'] as const };
  const grouping = { ...MERCURY_DEFAULTS, recencyDecay: 0.95 };

  beforeEach(() => {
    indexedDb = new IDBFactory();
  });

  async function load(): Promise<Tweaks> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PLAY_WITH_MERCURY,
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

  it('drops each value tuned back to the game’s own', async () => {
    const tweaks = await load();
    await tweaks.setPalette(palette);
    await tweaks.setSeasons(seasons);
    await tweaks.setGrouping(grouping);
    await tweaks.setBreakModel(VENUS);
    await tweaks.setColorSpace('hsl');
    await tweaks.setSeasonTurn(1);
    await tweaks.setLayout({ ...LAYOUT, keypad: { height: 30, width: 90 } });

    await tweaks.setPalette([...PALETTE]);
    await tweaks.setSeasons({ ...SEASON_STARTS });
    await tweaks.setBreakModel(MERCURY);
    await tweaks.setGrouping({ ...MERCURY_DEFAULTS });
    await tweaks.setColorSpace(SEASON_COLOR_SPACE);
    await tweaks.setSeasonTurn(SEASON_TURN);
    await tweaks.setLayout({ ...LAYOUT, keypad: { ...LAYOUT.keypad } });

    expect(tweaks.values()).toEqual({});
    expect((await load()).values()).toEqual({});
  });

  it('drops the stored values the game’s own have caught up with, keeping the others', async () => {
    await (await load()).setPalette(palette);
    await TestBed.inject(RunStore).saveSetting(TWEAKS, {
      format: TWEAKS_FORMAT,
      palette: [...PALETTE],
      // In another order than the game's.
      seasons: Object.fromEntries(Object.entries(SEASON_STARTS).reverse()),
      grouping: { mercury: MERCURY_DEFAULTS, venus: { ...VENUS.defaults, recencyDecay: 0.95 } },
      colorSpace: 'hsl',
    });

    const tweaks = await load();

    const tuned = {
      grouping: { venus: { ...VENUS.defaults, recencyDecay: 0.95 } },
      colorSpace: 'hsl',
    };
    expect(tweaks.values()).toEqual(tuned);
    expect(await TestBed.inject(RunStore).setting(TWEAKS)).toEqual({
      format: TWEAKS_FORMAT,
      ...tuned,
    });
  });

  it('keeps a change made before the stored tweaks were read', async () => {
    await (await load()).setPalette(palette);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [PLAY_WITH_MERCURY, { provide: INDEXED_DB, useValue: indexedDb }],
    });
    const tweaks = TestBed.inject(Tweaks);

    await tweaks.setSeasons(seasons);
    await tweaks.loaded;

    expect(tweaks.values()).toEqual({ seasons });
  });

  it('applies the tuned grouping settings only while developer mode is on, and keeps them', async () => {
    const tweaks = await load();
    await tweaks.setGrouping(grouping);

    expect(tweaks.grouping()).toBe(MERCURY_DEFAULTS);
    await TestBed.inject(DeveloperMode).set(true);
    expect(tweaks.grouping()).toEqual(grouping);
    expect((await load()).values()).toEqual({ grouping: { mercury: grouping } });
  });

  it('keeps each break model’s hyperparameters apart, whichever is picked', async () => {
    const tweaks = await load();
    await TestBed.inject(DeveloperMode).set(true);
    await tweaks.setGrouping(grouping);
    await tweaks.setBreakModel(VENUS);

    expect(tweaks.grouping()).toBe(VENUS.defaults);
    const venus = { ...MERCURY_DEFAULTS, window: 11 };
    await tweaks.setGrouping(venus);
    await tweaks.setBreakModel(MERCURY);
    expect(tweaks.grouping()).toEqual(grouping);
    await tweaks.setGrouping(undefined);
    expect(tweaks.values()).toEqual({ grouping: { venus } });
  });

  it('picks the break model only while developer mode is on, and keeps it', async () => {
    const tweaks = await load();
    await tweaks.setBreakModel(VENUS);

    expect(tweaks.breakModelKind()).toBe(MERCURY);
    await TestBed.inject(DeveloperMode).set(true);
    expect(tweaks.breakModelKind()).toBe(VENUS);
    expect((await load()).values()).toEqual({ breakModel: 'venus' });
    await TestBed.inject(Tweaks).setBreakModel(MERCURY);
    expect((await load()).values()).toEqual({});
    expect(parseTweaks({ format: TWEAKS_FORMAT, breakModel: 'pluto' })).toEqual({});
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

  it('counts down to the end of the group only in developer mode, unless told not to, and keeps that', async () => {
    const tweaks = await load();
    expect(tweaks.countdown()).toBe(false);
    await TestBed.inject(DeveloperMode).set(true);
    expect(tweaks.countdown()).toBe(true);

    await tweaks.setCountdown(false);
    expect(tweaks.countdown()).toBe(false);
    expect((await load()).values()).toEqual({ countdown: false });

    await TestBed.inject(Tweaks).setCountdown(true);
    expect((await load()).values()).toEqual({});
  });

  it('makes the keys solid only in developer mode, once told to, and keeps that', async () => {
    const tweaks = await load();
    await tweaks.setSolidKeys(true);
    expect(tweaks.solidKeys()).toBe(false);
    await TestBed.inject(DeveloperMode).set(true);
    expect(tweaks.solidKeys()).toBe(true);
    expect((await load()).values()).toEqual({ keys: 'solid' });

    await TestBed.inject(Tweaks).setSolidKeys(false);
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

  it('moves things on the screens only while developer mode is on, and keeps them there until undone', async () => {
    const tweaks = await load();
    const layout = { ...LAYOUT, keypad: { height: 40, width: 90 } };
    expect(tweaks.layout()).toEqual(LAYOUT);

    await tweaks.setLayout(layout);
    expect(tweaks.layout()).toEqual(LAYOUT);
    await TestBed.inject(DeveloperMode).set(true);
    expect(tweaks.layout()).toEqual(layout);
    expect((await load()).values()).toEqual({ layout });

    await TestBed.inject(Tweaks).setLayout(undefined);
    expect((await load()).values()).toEqual({});
  });

  it('reads the stored tweaks again once something else changed them', async () => {
    const tweaks = await load();
    await TestBed.inject(RunStore).saveSetting(TWEAKS, {
      format: TWEAKS_FORMAT,
      grouping: { mercury: grouping },
    });

    await tweaks.reload();

    expect(tweaks.values()).toEqual({ grouping: { mercury: grouping } });
  });

  it('writes tuned values as a backup holding them alone, which reads back as the same tweaks', () => {
    const backup = readBackup(tweaksBackup({ palette, seasonTurn: 3 }, 1000));

    expect(backup).toEqual({
      runs: [],
      skipped: 0,
      settings: { [TWEAKS]: { format: TWEAKS_FORMAT, palette, seasonTurn: 3 } },
    });
    expect('settings' in backup && parseTweaks(backup.settings[TWEAKS])).toEqual({
      palette,
      seasonTurn: 3,
    });
  });

  it('puts back the default of each stored grouping setting that is missing or out of range', () => {
    expect(parseTweaks({ format: TWEAKS_FORMAT, grouping: { mercury: grouping } })).toEqual({
      grouping: { mercury: grouping },
    });
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
      expect(
        parseTweaks({ format: TWEAKS_FORMAT, grouping: { mercury: { ...grouping, ...wrong } } }),
      ).toEqual({
        grouping: {
          mercury: { ...grouping, ...(key === undefined ? {} : { [key]: MERCURY_DEFAULTS[key] }) },
        },
      });
    }
  });

  it('keeps each break model’s pins, apart from the others', async () => {
    const tweaks = await load();
    await tweaks.togglePin(MERCURY, 'window');
    await tweaks.togglePin(MERCURY, 'level');
    await tweaks.togglePin(VENUS, 'level');
    await tweaks.togglePin(MERCURY, 'window');

    expect([...tweaks.pinsOf(MERCURY)]).toEqual(['level']);
    expect((await load()).values()).toEqual({ pins: { mercury: ['level'], venus: ['level'] } });
  });

  it('leaves out the pins of no hyperparameter of their model', () => {
    expect(
      parseTweaks({
        format: TWEAKS_FORMAT,
        pins: { mercury: ['window', 'droppedSince', 3], venus: 'level', pluto: ['window'] },
      }),
    ).toEqual({ pins: { mercury: ['window'] } });
  });

  it('keeps the grouping settings stored when others were added or dropped since', () => {
    expect(
      parseTweaks({
        format: TWEAKS_FORMAT,
        grouping: { mercury: { window: 31, recencyDecay: 0.95, droppedSince: 2 }, pluto: {} },
      }),
    ).toEqual({ grouping: { mercury: { ...MERCURY_DEFAULTS, window: 31, recencyDecay: 0.95 } } });
  });

  it('keeps the grouping settings stored before each model had its own, as Mercury’s', () => {
    expect(parseTweaks({ format: 1, breakModel: 'venus', grouping })).toEqual({
      breakModel: 'venus',
      grouping: { mercury: grouping },
    });
  });

  it('leaves out the settings saved for the timing model the break model replaced', () => {
    expect(
      parseTweaks({
        format: 1,
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
    expect(parseTweaks({ format: TWEAKS_FORMAT, countdown: false })).toEqual({ countdown: false });
    expect(parseTweaks({ format: TWEAKS_FORMAT, countdown: true })).toEqual({});
    expect(parseTweaks({ format: TWEAKS_FORMAT, keys: 'solid' })).toEqual({ keys: 'solid' });
    expect(parseTweaks({ format: TWEAKS_FORMAT, keys: 'clear' })).toEqual({});
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
