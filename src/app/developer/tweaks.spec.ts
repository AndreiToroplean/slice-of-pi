import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { PALETTE } from '../place-colors/place-colors';
import { INDEXED_DB, IS_PREVIEW, RunStore } from '../runs/run-store';
import { backgroundsFrom, SEASON_BACKGROUNDS } from '../seasons/seasons';
import { DeveloperMode } from './developer-mode';
import { parseTweaks, SEASON_STARTS, Tweaks, TWEAKS, TWEAKS_FORMAT } from './tweaks';

describe('Tweaks', () => {
  let indexedDb: IDBFactory;
  const palette = PALETTE.map((color, i) => (i === 3 ? '#123456' : color));
  const seasons = { ...SEASON_STARTS, autumn: ['#000000', '#ffffff'] as const };

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
  });

  it('applies the tuned values only while developer mode is on', async () => {
    const tweaks = await load();
    await tweaks.setPalette(palette);
    await tweaks.setSeasons(seasons);

    expect(tweaks.palette()).toBe(PALETTE);
    expect(tweaks.seasonBackgrounds()).toBe(SEASON_BACKGROUNDS);

    await TestBed.inject(DeveloperMode).set(true);
    expect(tweaks.palette()).toEqual(palette);
    expect(tweaks.seasonBackgrounds()).toEqual(backgroundsFrom(seasons));
  });

  it('keeps the tuned values for the next visits, and brings back the game’s on reset', async () => {
    const first = await load();
    await first.setPalette(palette);
    await first.setSeasons(seasons);

    const next = await load();
    expect(next.values()).toEqual({ palette, seasons });

    await next.setPalette(undefined);
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

  describe('exportText', () => {
    it('says when nothing differs from the game', async () => {
      const tweaks = await load();
      expect(tweaks.exportText()).toBe(
        "Slice of Pi tweaks: none, the game's values are unchanged.",
      );

      await tweaks.setPalette(PALETTE);
      await tweaks.setSeasons(SEASON_STARTS);
      expect(tweaks.exportText()).toBe(
        "Slice of Pi tweaks: none, the game's values are unchanged.",
      );
    });

    it('lists the whole palette, and only the seasons that differ', async () => {
      const tweaks = await load();
      await tweaks.setPalette(palette);
      await tweaks.setSeasons(seasons);

      expect(tweaks.exportText()).toBe(
        [
          'Slice of Pi tweaks',
          'Key colors (PALETTE in place-colors.ts), keys 0 to 9:',
          ...palette.map((color, i) => `  ${String(i)}: ${color}`),
          'Season colors (early colors in SEASON_BACKGROUNDS in seasons.ts), top then bottom:',
          '  autumn: #000000, #ffffff',
        ].join('\n'),
      );
    });
  });

  it('reads the tweaks stored in a format it knows, leaving out what is not valid', async () => {
    expect(parseTweaks({ format: TWEAKS_FORMAT, palette, seasons })).toEqual({ palette, seasons });
    expect(parseTweaks({ format: TWEAKS_FORMAT + 1, palette })).toEqual({});
    expect(
      parseTweaks({ format: TWEAKS_FORMAT, palette: ['#fff'], seasons: { spring: [] } }),
    ).toEqual({});
    expect(parseTweaks(null)).toEqual({});

    const store = (await load(), TestBed.inject(RunStore));
    await store.saveSetting(TWEAKS, { format: TWEAKS_FORMAT, palette });
    expect((await load()).values()).toEqual({ palette });
  });
});
