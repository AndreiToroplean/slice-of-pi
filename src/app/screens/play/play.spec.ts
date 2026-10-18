import { Location } from '@angular/common';
import { provideLocationMocks, SpyLocation } from '@angular/common/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  FakeAnimation,
  installAnimations,
  uninstallAnimations,
} from '../../../testing/fake-animations';
import { installDialogs, uninstallDialogs } from '../../../testing/fake-dialogs';
import { FakeTime } from '../../../testing/fake-time';
import { Background } from '../../ui/background';
import { FLIGHT_DURATION } from './flight/flight';
import { routes } from '../../app.routes';
import { Menu } from '../menu/menu';
import { PALETTE, placeColors } from '../../game/layers/place-colors';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { IDBFactory } from 'fake-indexeddb';
import { newRun } from '../../player-data/run';
import { RunRecorder } from '../../player-data/run-recorder';
import { INDEXED_DB, RunStore } from '../../player-data/run-store';
import { TypedDigits } from './typed-digits/typed-digits';
import { backgroundsFrom, seasonAt } from '../../game/layers/seasons';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { MARS } from '../../game/grouping/break-models/mars';
import { Tweaks } from '../../developer-mode/tweaks';
import { Play } from './play';
import { PLAY_WITH_MERCURY } from '../../../testing/game-break-model';

/** A pause clearly longer than the time between digits, in milliseconds. */
const PAUSE = 2000;

describe('Play', () => {
  // Compiles the play screen once, before its tests, so that the first one doesn't pay for it.
  beforeAll(async () => {
    TestBed.configureTestingModule({ providers: [PLAY_WITH_MERCURY, provideRouter(routes)] });
    const fixture = TestBed.createComponent(Play);
    await fixture.whenStable();
    TestBed.resetTestingModule();
  });

  let time: FakeTime;
  /** How many digits have been typed, to type them unevenly as players do. */
  let typed: number;

  beforeEach(() => {
    time = new FakeTime();
    typed = 0;
    TestBed.configureTestingModule({
      providers: [
        PLAY_WITH_MERCURY,
        provideRouter(routes),
        provideLocationMocks(),
        ...time.providers,
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function setUp(): Promise<{
    host: HTMLElement;
    type: (key: string) => Promise<void>;
    stable: () => Promise<void>;
  }> {
    const fixture = TestBed.createComponent(Play);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const type = async (key: string): Promise<void> => {
      time.advance(typed++ % 2 === 0 ? 150 : 250);
      host.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`)?.click();
      await fixture.whenStable();
    };
    return { host, type, stable: () => fixture.whenStable() };
  }

  /** Types the keys: `<` is backspace, and a space is a pause, long enough to finish a group. */
  async function typeAll(type: (key: string) => Promise<void>, keys: string): Promise<void> {
    for (const key of keys) {
      if (key === ' ') {
        time.advance(PAUSE);
        await TestBed.inject(ApplicationRef).whenStable();
      } else {
        await type(key === '<' ? 'backspace' : key);
      }
    }
  }

  function words(host: HTMLElement): string[] {
    return Array.from(host.querySelectorAll('app-typed-digits .word'), (word) =>
      word.textContent.replace(/\s/g, ''),
    );
  }

  function slots(host: HTMLElement): string[] {
    return Array.from(host.querySelectorAll('app-slots .slot'), (slot) => slot.textContent);
  }

  function summary(host: HTMLElement): string | undefined {
    return host.querySelector('app-typed-digits .visually-hidden')?.textContent;
  }

  /** Times of a run grouped by 3: a pause after every 3 digits, a little longer in each `run`, as no two are alike. */
  function by3(length: number, run = 0): number[] {
    let at = 0;
    return Array.from({ length }, (_, i) => {
      at += i === 0 ? 0 : i % 3 === 0 ? PAUSE + 50 * run : i % 2 === 0 ? 150 : 250;
      return at;
    });
  }

  /**
   * Sets up with `count` earlier runs of `length` digits, timed by `times` (grouped by 3 by default), once `before` has
   * run.
   */
  async function setUpWithRuns(
    count: number,
    checked = true,
    before = (): Promise<void> => Promise.resolve(),
    length = 15,
    times = (run: number): number[] => by3(length, run),
  ): ReturnType<typeof setUp> {
    TestBed.overrideProvider(INDEXED_DB, { useValue: new IDBFactory() });
    await before();
    const store = TestBed.inject(RunStore);
    for (let i = 0; i < count; i++) {
      await store.save({
        ...newRun(`earlier-${String(i)}`, i, checked),
        digits: PI_DECIMALS.slice(0, length),
        times: times(i),
      });
    }
    const setup = await setUp();
    // Reads come back in order: once this one is back, so is the play screen's.
    await store.runs();
    await setup.stable();
    return setup;
  }

  /**
   * Sets up for a player who has played once before, pausing after every 3 digits: enough to tell their breaks, but not
   * to trust their groups yet.
   */
  function setUpPlayed(): ReturnType<typeof setUp> {
    return setUpWithRuns(1, true, undefined, 30);
  }

  it('has a heading', async () => {
    const { host } = await setUp();

    expect(host.querySelector('h1')?.textContent).toBe('Slice of Pi');
  });

  it('starts with the "π=3." lead, no words and 5 empty slots', async () => {
    const { host } = await setUp();

    expect(host.querySelector('app-typed-digits .lead')?.textContent.replace(/\s/g, '')).toBe(
      'π=3.',
    );
    expect(words(host)).toEqual([]);
    expect(slots(host)).toEqual(['', '', '', '', '']);
    expect(summary(host)).toBe('No digits typed yet.');
  });

  it('fills the slots with the digits typed', async () => {
    const { host, type } = await setUp();

    await typeAll(type, '141');

    expect(slots(host)).toEqual(['1', '4', '1', '', '']);
    expect(words(host)).toEqual([]);
    expect(summary(host)).toBe('3 digits typed, the last one is 1.');
  });

  it('turns the digits typed into a word when the player pauses, and empties the slots', async () => {
    const { host, type } = await setUpPlayed();

    await typeAll(type, '141 ');

    expect(words(host)).toEqual(['141']);
    expect(slots(host)).toEqual(['', '', '', '', '']);

    await typeAll(type, '59265 3');

    expect(words(host)).toEqual(['141', '59265']);
    expect(slots(host)).toEqual(['3', '', '', '', '']);
    expect(summary(host)).toBe('9 digits typed, the last one is 3.');
  });

  it("grows a new player's group past 5 until they pause", async () => {
    const { host, type } = await setUp();

    await typeAll(type, '14159');

    expect(slots(host)).toEqual(['1', '4', '1', '5', '9']);

    await typeAll(type, '26');

    expect(words(host)).toEqual([]);
    expect(slots(host)).toEqual(['1', '4', '1', '5', '9', '2', '6']);

    await typeAll(type, ' ');
    expect(words(host)).toEqual(['1415926']);
  });

  it('adds slots past 5 until the player pauses, where their own groups are not trusted yet', async () => {
    const { host, type } = await setUpPlayed();

    await typeAll(type, '14159');

    expect(slots(host)).toEqual(['1', '4', '1', '5', '9']);

    await typeAll(type, '26');

    expect(words(host)).toEqual([]);
    expect(slots(host)).toEqual(['1', '4', '1', '5', '9', '2', '6']);

    await typeAll(type, ' ');
    expect(words(host)).toEqual(['1415926']);
    expect(slots(host)).toEqual(['', '', '', '', '']);
  });

  it("doesn't finish a group before the wait is clearly longer than the player's pace", async () => {
    const { host, type } = await setUpPlayed();
    await typeAll(type, '1415');

    time.advance(260);
    await TestBed.inject(ApplicationRef).whenStable();

    expect(words(host)).toEqual([]);
  });

  it("finishes a new player's group on their very first pause", async () => {
    const { host, type } = await setUp();

    await typeAll(type, '1 ');

    expect(words(host)).toEqual(['1']);
  });

  it('brings the last word back when backspace empties the slots, for the player to carry on', async () => {
    const { host, type } = await setUpPlayed();

    await typeAll(type, '141 5<');

    expect(words(host)).toEqual([]);
    expect(slots(host)).toEqual(['1', '4', '1', '', '']);

    await typeAll(type, '59 ');

    expect(words(host)).toEqual(['14159']);
  });

  it('finishes the word brought back by backspace once the player breaks there again', async () => {
    const { host, type } = await setUpPlayed();

    await typeAll(type, '141 5< ');

    expect(words(host)).toEqual(['141']);
    expect(slots(host)).toEqual(['', '', '', '', '']);
  });

  it('brings the last word back when backspace deletes a mistake that was alone in the slots', async () => {
    const { host, type } = await setUpPlayed();

    await typeAll(type, '141 7<');

    expect(words(host)).toEqual([]);
    expect(slots(host)).toEqual(['1', '4', '1', '', '']);
  });

  it('waits for a new pause after backspace, counted from it', async () => {
    const { host, type } = await setUpPlayed();
    await typeAll(type, '1415');
    time.advance(200);
    await type('backspace');

    time.advance(200);
    await TestBed.inject(ApplicationRef).whenStable();
    expect(words(host)).toEqual([]);

    await typeAll(type, ' ');
    expect(words(host)).toEqual(['141']);
  });

  describe("with the player's earlier runs", () => {
    it('leaves out the runs whose digits were not checked', async () => {
      const { host, type } = await setUpWithRuns(4, false);

      await typeAll(type, '141');

      expect(words(host)).toEqual([]);
      expect(slots(host)).toEqual(['1', '4', '1', '', '']);
    });

    it('counts the unchecked runs when developer mode says so', async () => {
      const { host, type } = await setUpWithRuns(4, false, async () => {
        await TestBed.inject(Tweaks).setIncludeUnchecked(true);
        await TestBed.inject(DeveloperMode).set(true);
      });

      await typeAll(type, '141');

      expect(words(host)).toEqual(['141']);
    });

    it('plays as if only the runs before the line played from existed, in developer mode', async () => {
      const { host, type } = await setUpWithRuns(4, true, async () => {
        await TestBed.inject(Tweaks).setRunOrder({
          ids: ['earlier-0', 'earlier-1', 'earlier-2', 'earlier-3'],
          line: 0,
        });
        await TestBed.inject(DeveloperMode).set(true);
      });

      await typeAll(type, '141');

      expect(words(host)).toEqual([]);
      expect(slots(host)).toEqual(['1', '4', '1', '', '']);
    });

    it('shows as many slots as the group expected', async () => {
      const { host, type } = await setUpWithRuns(4);

      expect(slots(host)).toEqual(['', '', '']);

      await typeAll(type, '1');
      expect(slots(host)).toEqual(['1', '', '']);
    });

    it('finishes a group at once where the runs agree it ends', async () => {
      const { host, type } = await setUpWithRuns(4);

      await typeAll(type, '141');

      expect(words(host)).toEqual(['141']);
      expect(slots(host)).toEqual(['', '', '']);
    });

    describe('where the earlier runs only just break', () => {
      /** Grouped by 3, except that the 3 oldest runs typed the first 6 digits as one group. */
      async function setUpRegrouped(): ReturnType<typeof setUp> {
        return setUpWithRuns(6, true, undefined, 15, (run) => {
          const times = by3(15, run);
          return run < 3
            ? times.map((time, i) => (i >= 3 ? time - PAUSE - 50 * run : time))
            : times;
        });
      }

      it("keeps the player's own group open while a fast next digit could still carry it on", async () => {
        const { host, type } = await setUpRegrouped();

        await typeAll(type, '141');
        expect(words(host)).toEqual([]);
        expect(slots(host)).toEqual(['1', '4', '1']);

        await typeAll(type, '5');
        expect(words(host)).toEqual([]);
        expect(slots(host)).toEqual(['1', '4', '1', '5', '', '']);

        await typeAll(type, '92');
        expect(words(host)).toEqual(['141592']);
      });

      it("finishes the player's own group once the player pauses after it", async () => {
        const { host, type } = await setUpRegrouped();

        await typeAll(type, '141 ');

        expect(words(host)).toEqual(['141']);
      });
    });

    it('keeps to the groups of the earlier runs all along the run, wherever it has got to', async () => {
      const { host, type } = await setUpWithRuns(4);

      for (const word of ['141', '592', '653']) {
        await typeAll(type, word);
        expect(slots(host)).toEqual(['', '', '']);
      }
      await typeAll(type, '589');

      expect(words(host)).toEqual(['141', '592', '653', '589']);
    });

    it('counts the run of a game restarted as an earlier run', async () => {
      installDialogs();
      try {
        // Too few runs to trust the player's groups, until the restarted one counts too.
        const { host, type, stable } = await setUpWithRuns(3);
        expect(slots(host)).toEqual(['', '', '', '', '']);
        await typeAll(type, '141 592 653 589 793 ');

        host.querySelector<HTMLButtonElement>('button[aria-label="Pause"]')?.click();
        Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
          .find((button) => button.textContent.trim() === 'Restart')
          ?.click();
        await stable();

        expect(slots(host)).toEqual(['', '', '']);
      } finally {
        uninstallDialogs();
      }
    });
  });

  describe('countdown to the end of the group', () => {
    function countdown(host: HTMLElement): string | undefined {
      return host.querySelector('app-break-countdown')?.textContent;
    }

    /** In developer mode, with a break model whose groups any pause long enough ends. */
    function setUpCounting(): ReturnType<typeof setUp> {
      return setUpWithRuns(4, true, async () => {
        await TestBed.inject(DeveloperMode).set(true);
        await TestBed.inject(Tweaks).setBreakModel(MARS);
      });
    }

    it('counts down, in developer mode, the seconds left before the pause ends the group', async () => {
      const { host, type, stable } = await setUpCounting();
      // Into the second group, past the first, which ends at once: where the runs carried on.
      await typeAll(type, '14159');
      expect(words(host)).toEqual(['141']);
      const left = Number(countdown(host));
      time.advance(300);
      await stable();

      expect(countdown(host)).toMatch(/^\d+\.\d$/);
      expect(Number(countdown(host))).toBeCloseTo(left - 0.3, 1);
    });

    it('ends the group as it reaches 0', async () => {
      const { host, type, stable } = await setUpCounting();
      await typeAll(type, '14159');
      const left = Number(countdown(host)) * 1000;
      time.advance(left - 100);
      await stable();

      expect(words(host)).toEqual(['141']);

      time.advance(200);
      await stable();

      expect(words(host)).toEqual(['141', '59']);
      expect(countdown(host)).toBeUndefined();
    });

    it('shows the longest wait looked at where no pause up to it ends the group', async () => {
      // The game's model only ends the player's own groups where the runs agree they end.
      const { host, type } = await setUpWithRuns(4, true, () =>
        TestBed.inject(DeveloperMode).set(true),
      );
      await typeAll(type, '14');

      expect(countdown(host)).toBe('> 10⁶');
    });

    it('shows nothing outside developer mode', async () => {
      const { host, type } = await setUpWithRuns(4);
      await typeAll(type, '14');

      expect(countdown(host)).toBeUndefined();
    });
  });

  it('deletes the last digit with backspace', async () => {
    const { host, type } = await setUp();

    await typeAll(type, '141<<4');

    expect(slots(host)).toEqual(['1', '4', '', '', '']);
    expect(summary(host)).toBe('2 digits typed, the last one is 4.');
  });

  it('reopens the last word with backspace when the slots are empty', async () => {
    const { host, type } = await setUp();

    await typeAll(type, '14159 26535 <');

    expect(words(host)).toEqual(['14159']);
    expect(slots(host)).toEqual(['2', '6', '5', '3', '']);

    await typeAll(type, '<<<<<');

    expect(words(host)).toEqual([]);
    expect(slots(host)).toEqual(['1', '4', '1', '5', '']);
  });

  it('does nothing on backspace when nothing is typed', async () => {
    const { host, type } = await setUp();

    await type('backspace');

    expect(slots(host)).toEqual(['', '', '', '', '']);
    expect(summary(host)).toBe('No digits typed yet.');
  });

  describe('mistakes', () => {
    function wrongSlots(host: HTMLElement): string[] {
      return Array.from(host.querySelectorAll('app-slots .slot.wrong'), (slot) => slot.textContent);
    }

    it('marks a wrong digit as a mistake in its slot, without finishing the group', async () => {
      const { host, type } = await setUp();

      await typeAll(type, '14150');

      expect(slots(host)).toEqual(['1', '4', '1', '5', '0']);
      expect(wrongSlots(host)).toEqual(['0']);
      expect(words(host)).toEqual([]);
      expect(summary(host)).toBe('4 digits typed, the last one is 5.');
      expect(host.querySelector('[aria-live="assertive"]')?.textContent.trim()).toBe(
        '0 is wrong: delete back to it to go on.',
      );
    });

    it('marks every digit typed on after a mistake as one too, until backspace deletes back to it', async () => {
      const { host, type } = await setUp();

      await typeAll(type, '1415092');
      expect(slots(host)).toEqual(['1', '4', '1', '5', '0', '9', '2']);
      expect(wrongSlots(host)).toEqual(['0', '9', '2']);
      expect(words(host)).toEqual([]);

      await typeAll(type, '<<');
      expect(wrongSlots(host)).toEqual(['0']);

      await typeAll(type, '<');
      expect(slots(host)).toEqual(['1', '4', '1', '5', '']);
      expect(wrongSlots(host)).toEqual([]);

      await typeAll(type, '9 ');
      expect(words(host)).toEqual(['14159']);
    });

    it('never finishes a group while a mistake shows, however long the player pauses', async () => {
      const { host, type } = await setUpPlayed();

      await typeAll(type, '1415  0   ');

      expect(words(host)).toEqual(['1415']);
      expect(slots(host)).toEqual(['0', '', '', '', '']);

      await typeAll(type, '9  ');
      expect(words(host)).toEqual(['1415']);
    });

    it('waits for the pause that finishes the group again once the mistake is deleted', async () => {
      const { host, type } = await setUpPlayed();
      await typeAll(type, '1410  <');
      expect(words(host)).toEqual([]);

      await typeAll(type, ' ');
      expect(words(host)).toEqual(['141']);
    });

    it('takes a wrong first digit', async () => {
      const { host, type } = await setUp();

      await typeAll(type, '3');

      expect(slots(host)).toEqual(['3', '', '', '', '']);
      expect(wrongSlots(host)).toEqual(['3']);
    });

    it("leaves the keys' colors as they were", async () => {
      const { host, type } = await setUp();
      await typeAll(type, '14');
      const colors = Array.from(host.querySelectorAll<HTMLElement>('app-keypad button'), (key) =>
        key.style.getPropertyValue('--key-color'),
      );

      await typeAll(type, '4');

      expect(
        Array.from(host.querySelectorAll<HTMLElement>('app-keypad button'), (key) =>
          key.style.getPropertyValue('--key-color'),
        ),
      ).toEqual(colors);
    });

    it('takes any digit when developer mode turns checking off', async () => {
      await TestBed.inject(Tweaks).setChecking(false);
      await TestBed.inject(DeveloperMode).set(true);
      const { host, type } = await setUp();

      await typeAll(type, '30');

      expect(slots(host)).toEqual(['3', '0', '', '', '']);
      expect(host.querySelector('app-slots .wrong')).toBeNull();
    });

    it('checks the digits again once developer mode is off', async () => {
      await TestBed.inject(Tweaks).setChecking(false);
      const { host, type } = await setUp();

      await typeAll(type, '3');

      expect(host.querySelector('app-slots .wrong')?.textContent).toBe('3');
    });

    it('records the backspaces deleting mistakes, at their places, but never the mistakes', async () => {
      const recorder = TestBed.inject(RunRecorder);
      const record = vi.spyOn(recorder, 'record');
      const deleteMistake = vi.spyOn(recorder, 'deleteMistake');
      const { type } = await setUp();

      await typeAll(type, '1415<03<<');

      expect(record.mock.calls).toEqual([['1'], ['4'], ['1'], ['5'], ['backspace']]);
      expect(deleteMistake.mock.calls).toEqual([[5], [4]]);
    });
  });

  describe('colors', () => {
    function keyColor(host: HTMLElement, key: string): string | undefined {
      return host
        .querySelector<HTMLElement>(`button[data-key="${key}"]`)
        ?.style.getPropertyValue('--key-color');
    }

    function placeColorsShown(host: HTMLElement, selector: string): string[] {
      return Array.from(host.querySelectorAll<HTMLElement>(selector), (element) =>
        element.style.getPropertyValue('--place-color'),
      ).filter((color) => color !== '');
    }

    it('gives each typed digit the color its key showed, and moves the key on to its next color', async () => {
      const { host, type } = await setUp();
      expect(keyColor(host, '1')).toBe(PALETTE[1]);

      await typeAll(type, '1');
      expect(placeColorsShown(host, 'app-slots .slot')).toEqual([PALETTE[1]]);
      expect(keyColor(host, '1')).toBe(PALETTE[2]);

      await typeAll(type, '41');
      expect(placeColorsShown(host, 'app-slots .slot')).toEqual([
        PALETTE[1],
        PALETTE[4],
        PALETTE[2],
      ]);
      expect(keyColor(host, '1')).toBe(PALETTE[3]);
    });

    it('uses the key colors tuned in developer mode', async () => {
      const tuned = PALETTE.map((_, i) => `#00000${String(i)}`);
      await TestBed.inject(Tweaks).setPalette(tuned);
      await TestBed.inject(DeveloperMode).set(true);
      const { host, type } = await setUp();
      expect(keyColor(host, '1')).toBe('#000001');

      await typeAll(type, '1');

      expect(placeColorsShown(host, 'app-slots .slot')).toEqual(['#000001']);
      expect(keyColor(host, '1')).toBe('#000002');
    });

    it('keeps the colors of the digits in their words and in the group being typed', async () => {
      const { host, type } = await setUp();

      await typeAll(type, '14159 26');

      expect(placeColorsShown(host, 'app-typed-digits .word .tile')).toEqual(placeColors('14159'));
      expect(placeColorsShown(host, 'app-slots .slot')).toEqual(placeColors('1415926').slice(5));
    });

    it('gives a key its color back when its digit is deleted', async () => {
      const { host, type } = await setUp();

      await typeAll(type, '141<');

      expect(keyColor(host, '1')).toBe(PALETTE[2]);
    });
  });

  it('records every key pressed in the run', async () => {
    const record = vi.spyOn(TestBed.inject(RunRecorder), 'record');
    const { type } = await setUp();

    await typeAll(type, '14<4');

    expect(record.mock.calls).toEqual([['1'], ['4'], ['backspace'], ['4']]);
  });

  describe('when a group is finished', () => {
    function stubAnimations(): FakeAnimation[] {
      vi.stubGlobal('matchMedia', () => ({ matches: false }));
      return installAnimations();
    }

    afterEach(() => {
      uninstallAnimations();
    });

    function shownTiles(host: HTMLElement): string {
      return Array.from(
        host.querySelectorAll<HTMLElement>('app-typed-digits .word .tile'),
        (tile) => (tile.style.visibility === 'hidden' ? '_' : tile.textContent.trim()),
      ).join('');
    }

    function flyingSlots(host: HTMLElement): string {
      return Array.from(host.querySelectorAll('.flying-slot'), (slot) => slot.textContent).join('');
    }

    it('flies each slot into its tile, which shows as its slot lands, so no digit ever goes missing', async () => {
      const animations = stubAnimations();
      const { host, type } = await setUp();

      await typeAll(type, '14159 ');

      expect(animations).toHaveLength(5);
      expect(flyingSlots(host)).toBe('14159');
      expect(shownTiles(host)).toBe('_____');

      for (const [i, animation] of animations.entries()) {
        animation.finish();
        expect(shownTiles(host)).toBe('14159'.slice(0, i + 1).padEnd(5, '_'));
        expect(flyingSlots(host)).toBe('14159'.slice(i + 1));
      }
    });

    it('starts every flight shaped like its slot, even while it waits for its turn to leave', async () => {
      const animations = stubAnimations();
      const { host, type } = await setUp();

      await typeAll(type, '14159 ');

      expect(animations.every((animation) => animation.options?.fill === 'both')).toBe(true);
      const radius = getComputedStyle(
        host.querySelector('app-slots .slot') ?? host,
      ).borderTopLeftRadius;
      for (const slot of host.querySelectorAll<HTMLElement>('.flying-slot')) {
        expect(slot.style.borderRadius).toBe(`${String(parseFloat(radius) || 0)}px`);
      }
    });

    it('aims for where the word will be once the typed digits have scrolled down to it', async () => {
      const animations = stubAnimations();
      const scrollDown = vi.spyOn(TypedDigits.prototype, 'scrollDown').mockReturnValue(50);
      const { type } = await setUp();

      await typeAll(type, '14159 ');

      expect(scrollDown).toHaveBeenCalledWith(FLIGHT_DURATION);
      expect(animations[0]?.keyframes[2]?.['transform']).toMatch(/^translate\(0px, -50px\)/);
    });

    it("doesn't fly a word brought back by backspace that finishes again at once", async () => {
      const animations = stubAnimations();
      const { host, type } = await setUpWithRuns(4);
      await typeAll(type, '141');
      expect(animations).toHaveLength(3);

      await typeAll(type, '5<');

      expect(words(host)).toEqual(['141']);
      expect(slots(host)).toEqual(['', '', '']);
      expect(animations).toHaveLength(3);
      expect(flyingSlots(host)).toBe('');
    });

    it('lands the flights at once on backspace', async () => {
      const animations = stubAnimations();
      const { host, type } = await setUp();

      await typeAll(type, '14159 <');

      expect(animations.every((animation) => animation.playState === 'idle')).toBe(true);
      expect(flyingSlots(host)).toBe('');
      expect(slots(host)).toEqual(['1', '4', '1', '5', '']);
    });

    it("doesn't fly when the player prefers reduced motion", async () => {
      const animations = stubAnimations();
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      const { host, type } = await setUp();

      await typeAll(type, '14159 ');

      expect(animations).toEqual([]);
      expect(shownTiles(host)).toBe('14159');
    });
  });

  it('starts with the spring background and header', async () => {
    const { host } = await setUp();

    expect(TestBed.inject(Background).colors()).toEqual(seasonAt(0).background);
    expect(host.querySelector('app-season-header .place')?.textContent.trim()).toBe(
      'Year 1 · digit 0 of 100',
    );
  });

  it('uses the season colors tuned in developer mode', async () => {
    const black = ['#000000', '#000000'] as const;
    const seasons = { spring: black, summer: black, autumn: black, winter: black };
    await TestBed.inject(Tweaks).setSeasons(seasons);
    await TestBed.inject(DeveloperMode).set(true);
    const { type } = await setUp();

    await type('1');

    expect(TestBed.inject(Background).colors()).toEqual(
      seasonAt(1, backgroundsFrom(seasons)).background,
    );
  });

  it('moves through the seasons as digits are typed, and back with backspace', async () => {
    const { host, type } = await setUp();

    await typeAll(type, PI_DECIMALS.slice(0, 25));

    expect(host.querySelector('app-season-header .name')?.textContent.trim()).toBe('Summer');
    expect(TestBed.inject(Background).colors()).toEqual(seasonAt(25).background);

    await type('backspace');

    expect(host.querySelector('app-season-header .name')?.textContent.trim()).toBe('Spring');
    expect(TestBed.inject(Background).colors()).toEqual(seasonAt(24).background);
  });

  it('takes the focus off what had it, such as the typed digits, as a key is typed into the game', async () => {
    const { host, type } = await setUp();
    const typedDigits = host.querySelector<HTMLElement>('app-typed-digits');
    typedDigits?.focus();
    expect(document.activeElement).toBe(typedDigits);

    await type('1');
    expect(document.activeElement).toBe(document.body);
  });

  describe('paused', () => {
    beforeEach(() => {
      installDialogs();
    });

    afterEach(() => {
      uninstallDialogs();
    });

    function pauseItem(host: HTMLElement, label: string): HTMLButtonElement {
      const item = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent.trim() === label || button.ariaLabel === label,
      );
      if (item === undefined) {
        throw new Error(`No button ${label}`);
      }
      return item;
    }

    it("ignores keys typed on a keyboard until it's resumed", async () => {
      const { host, type, stable } = await setUp();
      await type('1');

      pauseItem(host, 'Pause').click();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true }));
      await stable();
      expect(slots(host)).toEqual(['1', '', '', '', '']);

      pauseItem(host, 'Resume').click();
      await type('4');
      expect(slots(host)).toEqual(['1', '4', '', '', '']);
    });

    it('restarts the game: no digits nor mistake, back to the first spring', async () => {
      const { host, type, stable } = await setUp();
      // With pauses, as players do: their first run then tells them apart.
      await typeAll(type, '141 592 653 589 793 238 462 643 30');

      pauseItem(host, 'Pause').click();
      pauseItem(host, 'Restart').click();
      await stable();

      expect(words(host)).toEqual([]);
      expect(slots(host)).toEqual(['', '', '', '', '']);
      expect(host.querySelector('app-season-header .name')?.textContent.trim()).toBe('Spring');
      expect(TestBed.inject(Background).colors()).toEqual(seasonAt(0).background);
      expect(host.querySelector('dialog')?.open).toBe(false);

      await type('1');
      expect(slots(host)).toEqual(['1', '', '', '', '']);
    });

    it('ends the run when it restarts', async () => {
      const end = vi.spyOn(TestBed.inject(RunRecorder), 'end');
      const { host, stable } = await setUp();

      pauseItem(host, 'Pause').click();
      pauseItem(host, 'Restart').click();
      await stable();

      expect(end).toHaveBeenCalledOnce();
    });

    it('restarts during a flight, landing it at once', async () => {
      const animations = installAnimations();
      vi.stubGlobal('matchMedia', () => ({ matches: false }));
      try {
        const { host, type, stable } = await setUp();
        await typeAll(type, '14159 ');
        expect(animations.length).toBeGreaterThan(0);

        pauseItem(host, 'Pause').click();
        pauseItem(host, 'Restart').click();
        await stable();

        expect(animations.every((animation) => animation.playState === 'idle')).toBe(true);
        expect(words(host)).toEqual([]);
      } finally {
        uninstallAnimations();
      }
    });

    /** Ends the game, letting it navigate once the dialog has closed. */
    async function endGame(harness: RouterTestingHarness): Promise<void> {
      const host = harness.routeNativeElement;
      if (host === null) {
        throw new Error('No play screen');
      }
      pauseItem(host, 'Pause').click();
      pauseItem(host, 'End Game').click();
      await new Promise((resolve) => setTimeout(resolve));
    }

    it('ends a game started from the main menu by going back to it, so back then leaves', async () => {
      const harness = await RouterTestingHarness.create('/');
      // Listens to the history, as the app does once started.
      TestBed.inject(Router).initialNavigation();
      await harness.navigateByUrl('/play');
      const location = TestBed.inject(Location) as SpyLocation;
      const back = vi.spyOn(location, 'back');

      await endGame(harness);
      // The router follows the history going back on its next turn.
      await new Promise((resolve) => setTimeout(resolve));
      await harness.fixture.whenStable();

      expect(back).toHaveBeenCalledOnce();
      expect(TestBed.inject(Router).url).toBe('/');
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(Menu);
    });

    it('ends a game opened directly by putting the main menu in its place', async () => {
      const harness = await RouterTestingHarness.create('/play');
      const location = TestBed.inject(Location) as SpyLocation;
      const back = vi.spyOn(location, 'back');

      await endGame(harness);
      await harness.fixture.whenStable();

      expect(back).not.toHaveBeenCalled();
      expect(TestBed.inject(Router).url).toBe('/');
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(Menu);
      expect(location.urlChanges.at(-1)).toBe('replace: /');
    });

    it('ends the run when the game ends', async () => {
      const harness = await RouterTestingHarness.create('/play');
      const end = vi.spyOn(TestBed.inject(RunRecorder), 'end');

      await endGame(harness);
      await harness.fixture.whenStable();

      expect(end).toHaveBeenCalledOnce();
    });
  });
});
