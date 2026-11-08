import { SOUND_MIX } from '../../feedback/sound-mix';
import { KeypadLayoutSetting } from '../../player-data/keypad-layout-setting';
import { Location } from '@angular/common';
import { provideLocationMocks, SpyLocation } from '@angular/common/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  FakeAnimation,
  installAnimations,
  uninstallAnimations,
} from '../../../testing/fake-animations';
import { dialogNamed, installDialogs, uninstallDialogs } from '../../../testing/fake-dialogs';
import { FakeTime } from '../../../testing/fake-time';
import { Background } from '../../ui/background';
import { FIRST_LANDING, landsAt, leavesAt } from './flight/flight';
import { Vibrator } from '../../feedback/vibrator';
import { Speaker } from '../../feedback/speaker';
import { SOUND_MODEL } from '../../game/layers/sound/sound-models';
import { momentAt } from '../../../testing/sound-moments';
import { atTempo, SoundModel } from '../../game/layers/sound/sound-model';
import { routes } from '../../app.routes';
import { KEEP_HISTORY } from '../../app.config';
import { Menu } from '../menu/menu';
import { keyColorIndices, PALETTE, placeColors } from '../../game/layers/place-colors';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { IDBFactory } from 'fake-indexeddb';
import { newTouchLog } from '../../player-data/touch-log';
import { typeKey } from '../../../testing/touch-logs';
import { Digit } from '../../game/pi/digit';
import { RunRecorder } from '../../player-data/run-recorder';
import { Checkpoint } from '../../player-data/checkpoint';
import { INDEXED_DB, RunStore } from '../../player-data/run-store';
import { SCROLL_BACK_DURATION, TypedDigits } from './typed-digits/typed-digits';
import { backgroundsFrom, seasonAt } from '../../game/layers/seasons';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { startFrom } from '../../../testing/checkpoints';
import { MARS } from '../../game/grouping/break-models/mars';
import { Tweaks } from '../../developer-mode/tweaks';
import { LAYOUT } from '../../ui/layout';
import { GAME_OVER_DELAY, Play } from './play';
import { paceInterval, SHOWN_FADE } from '../../game/modes/discover-pace';
import { DiscoverRecorder } from '../../player-data/discover-recorder';
import { Keypad } from './keypad/keypad';
import { PLAY_WITH_MERCURY } from '../../../testing/game-break-model';
import { GAME_BREAK_MODEL } from '../../game/grouping/break-models/break-models';

/** The time between two digits Discover plays, at its default pace. */
const MEDIUM_INTERVAL = paceInterval('medium');

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
        provideRouter(routes, KEEP_HISTORY),
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
    play: Play;
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
    return { host, play: fixture.componentInstance, type, stable: () => fixture.whenStable() };
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

  /** How opaque the empty slots are. */
  function emptyOpacity(host: HTMLElement): number {
    return Number(
      host.querySelector<HTMLElement>('app-slots')?.style.getPropertyValue('--empty-opacity'),
    );
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
      const digitTimes = times(i);
      await store.save(
        Array.from(PI_DECIMALS.slice(0, length)).reduce(
          (log, digit, place) => typeKey(log, digit as Digit, digitTimes[place] ?? 0),
          newTouchLog(`earlier-${String(i)}`, i, checked),
        ),
      );
    }
    return setUp();
  }

  /**
   * Sets up for a player who has played once before, pausing after every 3 digits: enough to tell their breaks, but not
   * to trust their groups yet.
   */
  function setUpPlayed(): ReturnType<typeof setUp> {
    return setUpWithRuns(1, true, undefined, 30);
  }

  it('has a heading', { tags: ['disabled'] }, async () => {
    const { host } = await setUp();

    expect(host.querySelector('h1')?.textContent).toBe('Slice of Pi');
  });

  it('lays the keypad out as the player picked', async () => {
    await TestBed.inject(KeypadLayoutSetting).set('telephone');
    const { host } = await setUp();

    expect(
      Array.from(host.querySelectorAll<HTMLElement>('app-keypad button'), (key) =>
        key.textContent.trim(),
      ).slice(0, 3),
    ).toEqual(['1', '2', '3']);
  });

  it('lays the screen out as tuned in developer mode', async () => {
    await TestBed.inject(Tweaks).setLayout({ ...LAYOUT, keypad: { ...LAYOUT.keypad, top: 40 } });
    await TestBed.inject(DeveloperMode).set(true);
    const { host } = await setUp();

    expect(host.style.getPropertyValue('--keypad-top')).toBe('calc(40 * var(--unit))');
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

  it('leaves the last word on the tape when backspace empties the slots, and carries it on with a next digit typed fast', async () => {
    const { host, type } = await setUpPlayed();

    await typeAll(type, '141 5<');

    expect(words(host)).toEqual(['141']);
    expect(slots(host).every((slot) => slot === '')).toBe(true);

    await typeAll(type, '5');

    expect(words(host)).toEqual([]);
    expect(slots(host)).toEqual(['1', '4', '1', '5', '']);

    await typeAll(type, '9 ');

    expect(words(host)).toEqual(['14159']);
  });

  it('starts a new group, rather than carry the last word on, with a next digit typed after the break that ends it', async () => {
    const { host, type } = await setUpPlayed();

    await typeAll(type, '141 5< 5');

    expect(words(host)).toEqual(['141']);
    expect(slots(host)[0]).toBe('5');
  });

  it('lets a next digit typed fast carry the last word on once backspace deletes a mistake alone in the slots', async () => {
    const { host, type } = await setUpPlayed();

    await typeAll(type, '141 7<');
    expect(words(host)).toEqual(['141']);

    await typeAll(type, '5');
    expect(words(host)).toEqual([]);
    expect(slots(host)).toEqual(['1', '4', '1', '5', '']);
  });

  it('fades the empty slots out evenly as the wait for the group to end runs out, and back in for the next', async () => {
    const { host, type, stable } = await setUp();
    expect(emptyOpacity(host)).toBe(1);
    await typeAll(type, '141');
    expect(emptyOpacity(host)).toBe(1);

    const opacities: number[] = [];
    while (words(host).length === 0) {
      time.advance(100);
      await stable();
      opacities.push(emptyOpacity(host));
    }

    const faded = opacities.slice(0, -1);
    const steps = faded.slice(1).map((opacity, i) => (faded[i] ?? 0) - opacity);
    expect(steps.every((step) => step > 0 && Math.abs(step - (steps[0] ?? 0)) < 0.01)).toBe(true);
    expect(faded.at(-1)).toBeLessThan(steps[0] ?? 0);
    expect(emptyOpacity(host)).toBe(1);
  });

  it('keeps the slots the digits typed past them took, after backspace, until the group ends', async () => {
    const { host, type } = await setUp();
    await typeAll(type, '141592');
    expect(slots(host)).toHaveLength(6);

    await typeAll(type, '<<');
    expect(slots(host)).toEqual(['1', '4', '1', '5', '', '']);

    await typeAll(type, ' ');
    expect(words(host)).toEqual(['1415']);
    expect(slots(host)).toHaveLength(5);
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

    it('starts a group exactly at the checkpoint the game starts from, the player’s going on from there', async () => {
      // Grouped by 3 from place 0, so that place 50 ends the group from place 48.
      const { host, type } = await setUpWithRuns(
        4,
        true,
        () => {
          // The runs, of 60 digits, unlock it.
          TestBed.inject(Checkpoint).pick(50);
          return Promise.resolve();
        },
        60,
      );
      expect(slots(host)).toEqual(['']);

      await typeAll(type, '5');

      expect(words(host).at(-1)).toBe('5');
      expect(slots(host)).toEqual(['', '', '']);
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

        host.querySelector<HTMLButtonElement>('button[title="Pause"]')?.click();
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

    /** In developer mode, with the countdown on and a break model whose groups any pause long enough ends. */
    function setUpCounting(): ReturnType<typeof setUp> {
      return setUpWithRuns(4, true, async () => {
        await TestBed.inject(DeveloperMode).set(true);
        await TestBed.inject(Tweaks).setCountdown(true);
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
      const { host, type } = await setUpWithRuns(4, true, async () => {
        await TestBed.inject(DeveloperMode).set(true);
        await TestBed.inject(Tweaks).setCountdown(true);
      });
      await typeAll(type, '14');

      expect(countdown(host)).toBe('> 10⁶');
    });

    it('shows nothing in developer mode unless turned on', async () => {
      const { host, type } = await setUpWithRuns(4, true, () =>
        TestBed.inject(DeveloperMode).set(true),
      );
      await typeAll(type, '14');

      expect(countdown(host)).toBeUndefined();
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

    await typeAll(type, '<<<<');

    expect(words(host)).toEqual(['14159']);
    expect(slots(host).every((slot) => slot === '')).toBe(true);

    await typeAll(type, '<');

    expect(words(host)).toEqual([]);
    expect(slots(host)).toEqual(['1', '4', '1', '5', '']);
  });

  it('does nothing on backspace when nothing is typed', async () => {
    const { host, type } = await setUp();

    await type('backspace');

    expect(slots(host)).toEqual(['', '', '', '', '']);
    expect(summary(host)).toBe('No digits typed yet.');
  });

  describe('from a checkpoint', () => {
    beforeEach(async () => {
      await startFrom(50);
    });

    it('gives the digits before it, in words of 10 on the tape, checking those after it', async () => {
      const { host, type } = await setUp();
      expect(words(host)).toEqual(PI_DECIMALS.slice(0, 50).match(/.{10}/g));

      // Places 50 and 51 are 5 and 8.
      await typeAll(type, '58');
      expect(slots(host)).toEqual(['5', '8', '', '', '']);
      await typeAll(type, '0');
      expect(host.querySelector('app-slots .wrong')?.textContent).toBe('0');
    });

    it('never deletes the digits given', async () => {
      const { host, type } = await setUp();

      await typeAll(type, '5<<');

      expect(slots(host)).toEqual(['', '', '', '', '']);
      expect(words(host)).toHaveLength(5);
    });

    it('records its run from the checkpoint', async () => {
      await setUp();

      expect(TestBed.inject(RunRecorder).start()).toBe(50);
    });
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

    it('brings the tape back to the newest words on a mistake too, though it never reaches it', async () => {
      const { type } = await setUp();
      await typeAll(type, '14159 2');
      const scrollToEnd = vi.spyOn(TypedDigits.prototype, 'scrollToEnd');

      await typeAll(type, '0');

      expect(scrollToEnd).toHaveBeenCalledWith(SCROLL_BACK_DURATION);
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
        key.style.getPropertyValue('--press-color'),
      );

      await typeAll(type, '4');

      expect(
        Array.from(host.querySelectorAll<HTMLElement>('app-keypad button'), (key) =>
          key.style.getPropertyValue('--press-color'),
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

    it('records every key, mistakes and the backspaces deleting them included, its run leaving them out', async () => {
      const recorder = TestBed.inject(RunRecorder);
      const record = vi.spyOn(recorder, 'record');
      const { type } = await setUp();

      await typeAll(type, '1415<03<<');

      expect(record.mock.calls.map(([touch]) => touch.key)).toEqual([
        '1',
        '4',
        '1',
        '5',
        'backspace',
        '0',
        '3',
        'backspace',
        'backspace',
      ]);
      expect(recorder.run()?.digits).toBe('141');
    });
  });

  describe('colors', () => {
    function keyColor(host: HTMLElement, key: string): string | undefined {
      return host
        .querySelector<HTMLElement>(`button[data-key="${key}"]`)
        ?.style.getPropertyValue('--press-color');
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

  it('records touches elsewhere on the screen as typing nothing, but not those on the pause button', async () => {
    const record = vi.spyOn(TestBed.inject(RunRecorder), 'record');
    const { host, stable } = await setUp();
    const touch = (target: Element | null, pointerId: number): void => {
      const init = { pointerId, button: 0, bubbles: true, clientX: 10, clientY: 10 };
      target?.dispatchEvent(new PointerEvent('pointerdown', init));
      target?.dispatchEvent(new PointerEvent('pointerup', init));
    };

    touch(host.querySelector('app-slots'), 1);
    touch(host.querySelector('app-typed-digits'), 2);
    touch(host.querySelector('[title="Pause"]'), 3);
    await stable();

    expect(record.mock.calls.map(([touched]) => touched.key)).toEqual([null, null]);
  });

  it('records a touch elsewhere on the screen where it started', async () => {
    const record = vi.spyOn(TestBed.inject(RunRecorder), 'record');
    // jsdom has no layout: each point on the screen stands for the same point on the keypad.
    vi.spyOn(Keypad.prototype, 'pointOf').mockImplementation(({ clientX, clientY }) => ({
      x: clientX,
      y: clientY,
    }));
    const { host, stable } = await setUp();
    const slots = host.querySelector('app-slots');
    const init = { pointerId: 1, button: 0, bubbles: true };
    slots?.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: -1, clientY: -3 }));
    slots?.dispatchEvent(new PointerEvent('pointerup', { ...init, clientX: 1, clientY: -2 }));
    await stable();

    expect(record.mock.calls.map(([touched]) => touched)).toEqual([{ key: null, x: -1, y: -3 }]);
  });

  it('records every key pressed in the run', async () => {
    const record = vi.spyOn(TestBed.inject(RunRecorder), 'record');
    const { type } = await setUp();

    await typeAll(type, '14<4');

    expect(record.mock.calls).toEqual([
      [{ key: '1' }],
      [{ key: '4' }],
      [{ key: 'backspace' }],
      [{ key: '4' }],
    ]);
  });

  describe('when a group is finished', () => {
    /** The flights of the slots, leaving out how the slots move as they hand over. */
    function stubAnimations(): FakeAnimation[] {
      vi.stubGlobal('matchMedia', () => ({ matches: false }));
      return installAnimations((element) => element.classList.contains('flying-slot'));
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

    it('flies the digit typed last too when it ends its group at once, though it made room for a slot not shown yet', async () => {
      const animations = stubAnimations();
      // The game's own model, whose envelope lets no group be longer than 10 digits: the tenth ends it, as it's typed.
      TestBed.overrideProvider(GAME_BREAK_MODEL, { useValue: MARS });
      const { host, stable } = await setUp();

      // Evenly, so that no pause breaks it sooner.
      for (const digit of '1415926535') {
        time.advance(200);
        host.querySelector<HTMLButtonElement>(`button[data-key="${digit}"]`)?.click();
        await stable();
      }

      expect(words(host)).toEqual(['1415926535']);
      expect(animations).toHaveLength(10);
      expect(flyingSlots(host)).toBe('1415926535');
      expect(shownTiles(host)).toBe('__________');
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

    it('aims for where the word will be once the tape has made room for it, as the first slot lands', async () => {
      const animations = stubAnimations();
      const scrollToEnd = vi.spyOn(TypedDigits.prototype, 'scrollToEnd').mockReturnValue(50);
      const { type } = await setUp();

      await typeAll(type, '14159 ');

      expect(scrollToEnd).toHaveBeenCalledWith(FIRST_LANDING);
      expect(animations[0]?.keyframes[2]?.['transform']).toMatch(/^translate\(-50px, 0px\)/);
    });

    it("doesn't fly the last word again when backspace empties the slots, as it stays on the tape", async () => {
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

    it('vibrates as each slot plucks itself off, then as it lands on the tape', async () => {
      stubAnimations();
      const play = vi.spyOn(TestBed.inject(Vibrator), 'play');
      const { type } = await setUp();

      await typeAll(type, '14159 ');

      const indices = [0, 1, 2, 3, 4];
      expect(play).toHaveBeenCalledWith(
        'pluck',
        indices.map((i) => leavesAt(i, 0)),
      );
      expect(play).toHaveBeenCalledWith(
        'landing',
        indices.map((i) => landsAt(i, 0)),
      );
    });

    it('stops the vibrations of the flights yet to come as they land at once, on backspace', async () => {
      stubAnimations();
      const stops: ReturnType<typeof vi.fn>[] = [];
      vi.spyOn(TestBed.inject(Vibrator), 'play').mockImplementation(() => {
        const stop = vi.fn();
        stops.push(stop);
        return stop;
      });
      const { type } = await setUp();
      await typeAll(type, '14159 ');
      // The digits', then the plucks' and the landings'.
      const [plucks, landings] = stops.slice(5);

      await typeAll(type, '<');

      expect(plucks).toHaveBeenCalled();
      expect(landings).toHaveBeenCalled();
    });

    it("doesn't fly when the player prefers reduced motion", async () => {
      const animations = stubAnimations();
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      const { host, type } = await setUp();

      await typeAll(type, '14159 ');

      expect(animations).toEqual([]);
      expect(shownTiles(host)).toBe('14159');
    });

    it('plays the landing of the word as its last slot lands', async () => {
      stubAnimations();
      await TestBed.inject(DeveloperMode).set(true);
      await TestBed.inject(Tweaks).setSoundMix({ ...SOUND_MIX, landings: 1 });
      const play = vi.spyOn(TestBed.inject(Speaker), 'play');
      const { type } = await setUp();

      await typeAll(type, '14159 ');

      expect(play).toHaveBeenLastCalledWith(
        SOUND_MODEL.create().landing('14159', [5]),
        landsAt(4, 0),
        'landing',
      );
    });

    it('lands words silently when developer mode turns landings all the way down', async () => {
      stubAnimations();
      await TestBed.inject(DeveloperMode).set(true);
      await TestBed.inject(Tweaks).setSoundMix({ ...SOUND_MIX, landings: 0 });
      const play = vi.spyOn(TestBed.inject(Speaker), 'play');
      const { type } = await setUp();

      await typeAll(type, '14159 ');

      expect(play).toHaveBeenCalledTimes(5);
    });

    it('plays the landing at once when the word does not fly', async () => {
      stubAnimations();
      await TestBed.inject(DeveloperMode).set(true);
      await TestBed.inject(Tweaks).setSoundMix({ ...SOUND_MIX, landings: 1 });
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      const play = vi.spyOn(TestBed.inject(Speaker), 'play');
      const { type } = await setUp();

      await typeAll(type, '14159 ');

      expect(play).toHaveBeenLastCalledWith(
        SOUND_MODEL.create().landing('14159', [5]),
        0,
        'landing',
      );
    });
  });

  describe('sounds', () => {
    it('plays what the sound model says each key plays at its place, right digits and mistakes alike', async () => {
      const play = vi.spyOn(TestBed.inject(Speaker), 'play');
      const { type } = await setUp();

      await typeAll(type, '149<');

      const keys = (place: number): ReturnType<SoundModel['keys']> =>
        SOUND_MODEL.create().keys(momentAt(place, [], 5));
      expect(play.mock.calls.map(([chime]) => chime)).toEqual([
        keys(1)['1'],
        keys(2)['4'],
        keys(3)['9'],
      ]);
    });

    it('plays a key as soon as the touch lands on it, before it is typed, and not again once typed', async () => {
      const play = vi.spyOn(TestBed.inject(Speaker), 'play');
      const fixture = TestBed.createComponent(Play);
      await fixture.whenStable();
      const keypad = fixture.debugElement.query(By.directive(Keypad)).componentInstance as Keypad;

      keypad.pressed.emit('7');
      expect(play).toHaveBeenLastCalledWith(SOUND_MODEL.create().keys(momentAt(1, [], 5))['7']);

      keypad.touched.emit({ key: '7', x: 0.5, y: 0.5 });
      expect(play).toHaveBeenCalledTimes(1);

      keypad.pressed.emit('backspace');
      expect(play).toHaveBeenCalledTimes(1);
    });

    it("takes a wrong key's note off once it's typed, as it rings, and leaves a right key's be", async () => {
      const sours: string[] = [];
      vi.spyOn(TestBed.inject(Speaker), 'play').mockImplementation((chime) => ({
        stop: vi.fn(),
        sour: () => {
          sours.push(String(chime[0]?.pitch));
        },
      }));
      const fixture = TestBed.createComponent(Play);
      await fixture.whenStable();
      const keypad = fixture.debugElement.query(By.directive(Keypad)).componentInstance as Keypad;
      const keys = SOUND_MODEL.create().keys(momentAt(1, [], 5));

      keypad.pressed.emit('1');
      keypad.touched.emit({ key: '1', x: 0.5, y: 0.5 });
      expect(sours).toEqual([]);

      keypad.pressed.emit('7');
      expect(sours).toEqual([]);
      keypad.touched.emit({ key: '7', x: 0.5, y: 0.5 });
      expect(sours).toEqual([String(keys['7'][0]?.pitch)]);
    });

    it('plays the next words in their own place in the song', async () => {
      const play = vi.spyOn(TestBed.inject(Speaker), 'play');
      const { type } = await setUp();

      await typeAll(type, '141 5');

      expect(play).toHaveBeenLastCalledWith(SOUND_MODEL.create().keys(momentAt(4, [3], 5))['5']);
    });

    it('logs a line for each key typed, and each word landing, in developer mode once told to', async () => {
      await TestBed.inject(DeveloperMode).set(true);
      await TestBed.inject(Tweaks).setSoundNotes(true);
      await TestBed.inject(Tweaks).setSoundMix({ ...SOUND_MIX, landings: 1 });
      const { host, type } = await setUp();
      const lines = (): string[] =>
        Array.from(host.querySelectorAll('app-sound-log p'), (line) => line.textContent);
      expect(lines()).toEqual([]);

      await typeAll(type, '14159 ');

      const model = SOUND_MODEL.create();
      // Newest first.
      expect(lines()).toEqual(
        [
          ...Array.from('14159', (digit, i) =>
            model.describe(momentAt(i + 1, [], 5), digit as Digit),
          ),
          model.describeLanding('14159', [5]),
        ].reverse(),
      );
    });

    it("doesn't show what keys played unless told to, nor outside developer mode", async () => {
      await TestBed.inject(Tweaks).setSoundNotes(true);
      const { host, type } = await setUp();

      await type('1');

      expect(host.querySelector('app-sound-log')).toBeNull();
    });

    it("plays a run replayed key by key as it's typed, at the replay's tempo", async () => {
      const play = vi.spyOn(TestBed.inject(Speaker), 'play');
      const fixture = TestBed.createComponent(Play);
      fixture.componentRef.setInput('replay', newTouchLog('run', 0));
      fixture.componentRef.setInput('tempo', 2);
      await fixture.whenStable();

      fixture.componentInstance.replayTouch({ key: '1', x: 0.5, y: 0.5 });
      fixture.componentInstance.replayTouch({ key: null, x: 3, y: 0 });
      fixture.componentInstance.replayTouch({ key: 'backspace', x: 0.5, y: 0.5 });

      expect(play.mock.calls).toEqual([
        [atTempo(SOUND_MODEL.create().keys(momentAt(1, [], 5))['1'], 2)],
      ]);
    });

    it('plays nothing of a run replayed muted, nor skipping ahead in it', async () => {
      const play = vi.spyOn(TestBed.inject(Speaker), 'play');
      const fixture = TestBed.createComponent(Play);
      fixture.componentRef.setInput('replay', newTouchLog('run', 0));
      fixture.componentRef.setInput('muted', true);
      await fixture.whenStable();
      fixture.componentInstance.replayTouch({ key: '1' });

      fixture.componentRef.setInput('muted', false);
      await fixture.whenStable();
      fixture.componentInstance.quiet = true;
      fixture.componentInstance.replayTouch({ key: '4' });

      expect(play).not.toHaveBeenCalled();
    });
  });

  describe('vibrations', () => {
    it('vibrates on each digit, mistake and backspace', async () => {
      const play = vi.spyOn(TestBed.inject(Vibrator), 'play');
      const { type } = await setUp();

      await typeAll(type, '1499<<');

      expect(play.mock.calls.map(([vibration]) => vibration)).toEqual([
        'digit',
        'digit',
        'mistake',
        'mistake',
        'backspace',
        'backspace',
      ]);
    });

    it("doesn't vibrate replaying a run", async () => {
      const play = vi.spyOn(TestBed.inject(Vibrator), 'play');
      const fixture = TestBed.createComponent(Play);
      fixture.componentRef.setInput('replay', newTouchLog('run', 0));
      await fixture.whenStable();

      fixture.componentInstance.replayTouch({ key: '1' });
      fixture.componentInstance.replayTouch({ key: '9' });
      fixture.componentInstance.replayTouch({ key: 'backspace' });
      await fixture.whenStable();

      expect(play).not.toHaveBeenCalled();
    });
  });

  it('starts with the spring background and header', async () => {
    const { host } = await setUp();

    expect(TestBed.inject(Background).colors()).toEqual(seasonAt(0).background);
    expect(host.querySelector('app-season-header .count')?.textContent.trim()).toBe('Digit 0');
    expect(host.querySelector('app-season-header .season')?.textContent.trim()).toBe(
      'Spring · Year 0',
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

    expect(host.querySelector('app-season-header .season')?.textContent.trim()).toBe(
      'Summer · Year 0',
    );
    expect(TestBed.inject(Background).colors()).toEqual(seasonAt(25).background);

    await type('backspace');

    expect(host.querySelector('app-season-header .season')?.textContent.trim()).toBe(
      'Spring · Year 0',
    );
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
        (button) => button.textContent.trim() === label || button.title === label,
      );
      if (item === undefined) {
        throw new Error(`No button ${label}`);
      }
      return item;
    }

    it('stops the clock while paused: no group ends meanwhile, nor does the pause count between digits', async () => {
      const { host, type, stable } = await setUp();
      await typeAll(type, '141');

      pauseItem(host, 'Pause').click();
      time.advance(10 * PAUSE);
      await stable();
      expect(words(host)).toEqual([]);

      pauseItem(host, 'Resume').click();
      await stable();
      expect(words(host)).toEqual([]);
      await type('5');
      expect(TestBed.inject(RunRecorder).run()?.times.at(-1)).toBe(250 + 150 + 250);

      time.advance(PAUSE);
      await stable();
      expect(words(host)).toEqual(['1415']);
    });

    it('edits the layout from the pause dialog in developer mode, paused, with 10 slots and the touch areas', async () => {
      await TestBed.inject(DeveloperMode).set(true);
      const { host, type, stable } = await setUp();
      await typeAll(type, '14');

      pauseItem(host, 'Pause').click();
      pauseItem(host, 'Edit Layout').click();
      await stable();
      expect(host.querySelector('app-layout-editor')).not.toBeNull();
      expect(host.querySelector('dialog')?.open).toBe(false);
      expect(slots(host)).toEqual(['1', '4', '', '', '', '', '', '', '', '']);
      expect(host.querySelectorAll('app-keypad .area').length).toBeGreaterThan(0);

      await type('1');
      time.advance(10 * PAUSE);
      await stable();
      expect(slots(host)).toEqual(['1', '4', '', '', '', '', '', '', '', '']);
      expect(words(host)).toEqual([]);

      pauseItem(host, 'Done').click();
      await stable();
      expect(host.querySelector('app-layout-editor')).toBeNull();
      expect(host.querySelector('app-keypad .area')).toBeNull();
      expect(host.querySelector('dialog')?.open).toBe(true);
      pauseItem(host, 'Resume').click();
      await type('1');
      expect(slots(host)).toEqual(['1', '4', '1', '', '']);
    });

    it('shows the layout as it’s edited, and on going back, asks whether to cancel the changes', async () => {
      await TestBed.inject(DeveloperMode).set(true);
      const { host, play, stable } = await setUp();
      const pauseDialog = host.querySelector<HTMLDialogElement>('app-pause dialog');
      const cancelDialog = (): HTMLDialogElement | null =>
        host.querySelector('app-layout-editor dialog');
      const keypadTop = (): string => host.style.getPropertyValue('--keypad-top');
      pauseItem(host, 'Pause').click();
      pauseItem(host, 'Edit Layout').click();
      await stable();
      host.querySelector<HTMLButtonElement>('button.part[aria-label="Keypad"]')?.click();
      await stable();

      const knob = host.querySelector<HTMLElement>('[role="slider"][aria-label="Keypad top"]');
      knob?.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
      await stable();
      expect(keypadTop()).toBe(`calc(${String(LAYOUT.keypad.top + 1)} * var(--unit))`);

      expect(play.leaveOnBack()).toBe(false);
      expect(cancelDialog()?.open).toBe(true);
      expect(play.leaveOnBack()).toBe(false);
      expect(cancelDialog()?.open).toBe(false);
      expect(host.querySelector('app-layout-editor')).not.toBeNull();

      play.leaveOnBack();
      pauseItem(host, 'Yes').click();
      await stable();
      expect(host.querySelector('app-layout-editor')).toBeNull();
      expect(pauseDialog?.open).toBe(true);
      expect(keypadTop()).toBe(`calc(${String(LAYOUT.keypad.top)} * var(--unit))`);
    });

    it('shows the screen as in the game while previewing the layout, and edits it again after', async () => {
      await TestBed.inject(DeveloperMode).set(true);
      const { host, stable } = await setUp();
      pauseItem(host, 'Pause').click();
      pauseItem(host, 'Edit Layout').click();
      await stable();

      pauseItem(host, 'Preview').click();
      await stable();
      expect(slots(host)).toEqual(['', '', '', '', '']);
      expect(host.querySelector('app-keypad .area')).toBeNull();

      pauseItem(host, 'Done').click();
      await stable();
      pauseItem(host, 'Edit Layout').click();
      await stable();
      expect(slots(host)).toHaveLength(10);
      expect(host.querySelector('button[title="Preview"]')?.getAttribute('aria-pressed')).toBe(
        'false',
      );
    });

    it('keeps the changes to the layout once done', async () => {
      await TestBed.inject(DeveloperMode).set(true);
      const { host, stable } = await setUp();
      pauseItem(host, 'Pause').click();
      pauseItem(host, 'Edit Layout').click();
      await stable();
      host.querySelector<HTMLButtonElement>('button.part[aria-label="Keypad"]')?.click();
      await stable();

      host
        .querySelector('[role="slider"][aria-label="Keypad top"]')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
      pauseItem(host, 'Done').click();
      await stable();

      expect(host.querySelector('app-pause dialog')?.hasAttribute('open')).toBe(true);
      expect(host.style.getPropertyValue('--keypad-top')).toBe(
        `calc(${String(LAYOUT.keypad.top + 1)} * var(--unit))`,
      );
    });

    it('keeps the empty slots as faded as they were while paused', async () => {
      const { host, type, stable } = await setUp();
      await typeAll(type, '141');
      time.advance(300);
      await stable();
      const faded = emptyOpacity(host);
      expect(faded).toBeLessThan(1);

      pauseItem(host, 'Pause').click();
      time.advance(10 * PAUSE);
      await stable();

      expect(emptyOpacity(host)).toBe(faded);
    });

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
      expect(host.querySelector('app-season-header .season')?.textContent.trim()).toBe(
        'Spring · Year 0',
      );
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

    it('stops the game and replays its run in its place, once saved', async () => {
      TestBed.overrideProvider(INDEXED_DB, { useValue: new IDBFactory() });
      const harness = await RouterTestingHarness.create('/play');
      const host = harness.routeNativeElement;
      if (host === null) {
        throw new Error('No play screen');
      }
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      pauseItem(host, 'Pause').click();
      await harness.fixture.whenStable();
      expect(pauseItem(host, 'Replay This Run').disabled).toBe(true);
      pauseItem(host, 'Resume').click();

      time.advance(150);
      host.querySelector<HTMLButtonElement>('button[data-key="1"]')?.click();
      await harness.fixture.whenStable();
      pauseItem(host, 'Pause').click();
      await harness.fixture.whenStable();
      pauseItem(host, 'Replay This Run').click();
      await harness.fixture.whenStable();
      pauseItem(host, 'Watch Replay').click();
      await new Promise((resolve) => setTimeout(resolve));
      await TestBed.inject(RunRecorder).saved();
      await harness.fixture.whenStable();

      expect(navigate).toHaveBeenCalledWith(['/runs', 'run-1', 'replay'], {
        replaceUrl: true,
        state: { menuBehind: false },
      });
      expect((await TestBed.inject(RunStore).touchLogs()).map((run) => run.id)).toEqual(['run-1']);
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

    it('pauses as the player goes back, rather than leaving, and resumes going back again', async () => {
      const harness = await RouterTestingHarness.create('/');
      TestBed.inject(Router).initialNavigation();
      const play = await harness.navigateByUrl('/play', Play);
      const location = TestBed.inject(Location);

      for (const paused of [true, false]) {
        location.back();
        await new Promise((resolve) => setTimeout(resolve));
        await harness.fixture.whenStable();

        expect(harness.routeDebugElement?.componentInstance).toBe(play);
        expect(host(harness).querySelector<HTMLDialogElement>('dialog')?.open).toBe(paused);
      }
    });

    function host(harness: RouterTestingHarness): HTMLElement {
      const element = harness.routeNativeElement;
      if (element === null) {
        throw new Error('No play screen');
      }
      return element;
    }

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
    describe('in a challenge', () => {
      async function challenge(): Promise<{
        host: HTMLElement;
        type: (keys: string) => Promise<void>;
        stable: () => Promise<void>;
      }> {
        const harness = await RouterTestingHarness.create('/challenge');
        const host = harness.routeNativeElement;
        if (host === null) {
          throw new Error('No play screen');
        }
        const stable = (): Promise<void> => harness.fixture.whenStable();
        const type = async (keys: string): Promise<void> => {
          for (const key of keys) {
            time.advance(200);
            host.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`)?.click();
            await stable();
          }
        };
        return { host, type, stable };
      }

      function gameOver(host: HTMLElement): HTMLDialogElement {
        return dialogNamed(host, 'Game Over');
      }

      it('ends the game on the first mistake: no more keys, and a moment later, the game over dialog', async () => {
        const { host, type, stable } = await challenge();

        await type('1410');
        await type('5');
        expect(slots(host)).toEqual(['1', '4', '1', '0', '']);
        expect(host.querySelector('[aria-live="assertive"]')?.textContent.trim()).toBe(
          '0 is wrong: game over.',
        );
        expect(gameOver(host).open).toBe(false);

        time.advance(GAME_OVER_DELAY);
        await stable();
        expect(gameOver(host).open).toBe(true);
      });

      it('has no backspace', async () => {
        const { host } = await challenge();

        const backspace = host.querySelector<HTMLButtonElement>('button[data-key="backspace"]');
        expect(backspace?.inert).toBe(true);
      });

      it('checks every digit, even when developer mode turns checking off', async () => {
        await TestBed.inject(Tweaks).setChecking(false);
        await TestBed.inject(DeveloperMode).set(true);
        const { host, type } = await challenge();

        await type('3');

        expect(host.querySelector('app-slots .wrong')?.textContent).toBe('3');
      });

      it('has its runs recorded as challenges, checking their digits', async () => {
        await challenge();

        expect(TestBed.inject(RunRecorder).challenge()).toBe(true);
      });

      it('turns the screen red as soon as the game is lost, until it restarts', async () => {
        const { host, type, stable } = await challenge();
        await type('1');
        expect(host.querySelector('.game-over')).toBeNull();

        await type('0');
        expect(host.querySelector('.game-over')).not.toBeNull();

        time.advance(GAME_OVER_DELAY);
        await stable();
        pauseItem(host, 'Play Again').click();
        await stable();
        expect(host.querySelector('.game-over')).toBeNull();
      });

      it('continues the run in free play from the mistake, backspace and all, until it restarts as a challenge', async () => {
        const end = vi.spyOn(TestBed.inject(RunRecorder), 'end');
        const { host, type, stable } = await challenge();
        await type('140');
        time.advance(GAME_OVER_DELAY);
        await stable();

        pauseItem(host, 'Continue in Free Play').click();
        await stable();
        expect(gameOver(host).open).toBe(false);
        expect(host.querySelector('.game-over')).toBeNull();
        const backspace = (): HTMLButtonElement | null =>
          host.querySelector<HTMLButtonElement>('button[data-key="backspace"]');
        expect(backspace()?.inert).toBe(false);

        await type('2');
        expect(slots(host)).toEqual(['1', '4', '0', '2', '']);
        backspace()?.click();
        backspace()?.click();
        await stable();
        await type('1');
        expect(slots(host)).toEqual(['1', '4', '1', '', '']);
        expect(end).not.toHaveBeenCalled();

        pauseItem(host, 'Pause').click();
        pauseItem(host, 'Restart').click();
        await stable();
        expect(backspace()?.inert).toBe(true);
      });

      it('plays again from the game over dialog, from the start, the keys typing again', async () => {
        const end = vi.spyOn(TestBed.inject(RunRecorder), 'end');
        const { host, type, stable } = await challenge();
        await type('140');
        time.advance(GAME_OVER_DELAY);
        await stable();

        pauseItem(host, 'Play Again').click();
        await stable();

        expect(gameOver(host).open).toBe(false);
        expect(end).toHaveBeenCalledOnce();
        await type('1');
        expect(slots(host)).toEqual(['1', '', '', '', '']);
      });

      it('replaces the pause dialog with the game over dialog, if it opened meanwhile', async () => {
        const { host, type, stable } = await challenge();
        await type('0');

        pauseItem(host, 'Pause').click();
        time.advance(GAME_OVER_DELAY);
        await stable();

        const dialogs = Array.from(host.querySelectorAll('dialog'), (dialog) => dialog.open);
        expect(dialogs.filter(Boolean)).toHaveLength(1);
        expect(gameOver(host).open).toBe(true);
      });
    });
  });
  describe('in Discover', () => {
    beforeEach(() => {
      installDialogs();
    });

    afterEach(() => {
      uninstallDialogs();
    });

    interface Round {
      host: HTMLElement;
      /** Lets the time go by. */
      wait: (milliseconds: number) => Promise<void>;
      /** Types keys on the keypad. */
      type: (keys: string) => Promise<void>;
    }

    /** Opens Discover, once the earlier runs, if any, are kept. */
    async function discover(runs: readonly number[][] = []): Promise<Round> {
      const indexedDb = new IDBFactory();
      TestBed.overrideProvider(INDEXED_DB, { useValue: indexedDb });
      const store = TestBed.inject(RunStore);
      for (const [i, times] of runs.entries()) {
        await store.save(
          Array.from(PI_DECIMALS.slice(0, times.length)).reduce(
            (log, digit, place) => typeKey(log, digit as Digit, times[place] ?? 0),
            newTouchLog(`earlier-${String(i)}`, i),
          ),
        );
      }
      const harness = await RouterTestingHarness.create('/discover');
      const host = harness.routeNativeElement;
      if (host === null) {
        throw new Error('No play screen');
      }
      const wait = async (milliseconds: number): Promise<void> => {
        time.advance(milliseconds);
        await harness.fixture.whenStable();
      };
      const type = async (keys: string): Promise<void> => {
        for (const key of keys) {
          time.advance(150);
          host.querySelector<HTMLButtonElement>(`button[data-key="${key}"]`)?.click();
          await harness.fixture.whenStable();
        }
      };
      await wait(0);
      return { host, wait, type };
    }

    function shownKey(host: HTMLElement): string | undefined {
      return host.querySelector<HTMLElement>('app-keypad .key.pressed:not(.discover)')?.dataset[
        'key'
      ];
    }

    function discoverKey(host: HTMLElement): HTMLButtonElement {
      const key = host.querySelector<HTMLButtonElement>('button[data-key="backspace"]');
      if (key === null) {
        throw new Error('No discover key');
      }
      return key;
    }

    /** The faint digits on the tape: those the game showed. */
    function faint(host: HTMLElement): string {
      return Array.from(host.querySelectorAll('app-typed-digits .tile.faint'), (tile) =>
        tile.textContent.trim(),
      ).join('');
    }

    /** Lets the game play a round of `length` digits, up to the player's turn. */
    async function listen({ wait }: Round, length: number): Promise<void> {
      await wait((length + 1) * MEDIUM_INTERVAL);
    }

    /** Asks the game to show the round, with the discover key. */
    async function showMe({ host, wait }: Round): Promise<void> {
      discoverKey(host).click();
      await wait(0);
    }

    /**
     * Plays the rounds reaching these places, as the player retypes each, from the start of π, asking for the next one
     * but after the last.
     */
    async function playRounds(round: Round, ...reached: number[]): Promise<void> {
      for (const [i, place] of reached.entries()) {
        await listen(round, place);
        await round.type(PI_DECIMALS.slice(0, place));
        if (i < reached.length - 1) {
          await showMe(round);
        }
      }
    }

    it('plays the first group, keys pressed, the discover key held, then hands it over, faint and fading off the tape', async () => {
      const round = await discover();
      expect(discoverKey(round.host).getAttribute('aria-label')).toBe('Show me');
      expect(discoverKey(round.host).classList).toContain('pressed');

      await round.wait(MEDIUM_INTERVAL);
      expect(slots(round.host)[0]).toBe('1');
      expect(shownKey(round.host)).toBe('1');

      await round.wait(5 * MEDIUM_INTERVAL);
      expect(faint(round.host)).toBe('14159');
      expect(discoverKey(round.host).classList).not.toContain('pressed');

      await round.wait(SHOWN_FADE);
      expect(faint(round.host)).toBe('');
      expect(words(round.host)).toEqual([]);
    });

    it('fades the digits shown out for as long as developer mode sets', async () => {
      const round = await discover();
      await TestBed.inject(DeveloperMode).set(true);
      await TestBed.inject(Tweaks).setShownFade(2000);

      await round.wait(6 * MEDIUM_INTERVAL + SHOWN_FADE);
      expect(faint(round.host)).toBe('14159');

      await round.wait(1000);
      expect(faint(round.host)).toBe('');
    });

    it('vibrates as the turn goes to the game, and back to the player', async () => {
      const vibrate = vi.spyOn(Vibrator.prototype, 'play');
      const round = await discover();
      await listen(round, 5);

      expect(vibrate.mock.calls.filter(([vibration]) => vibration === 'turn')).toHaveLength(2);
    });

    it('shows the key colors and the season of the player’s place on their turn, not of the digits shown', async () => {
      const round = await discover();
      await listen(round, 5);

      expect(faint(round.host)).toBe('14159');
      expect(round.host.querySelector('app-season-header .count')?.textContent.trim()).toBe(
        'Digit 0',
      );
      expect(
        round.host
          .querySelector<HTMLElement>('button[data-key="1"]')
          ?.style.getPropertyValue('--press-color'),
      ).toBe(PALETTE[keyColorIndices('')['1']]);
    });

    it('clears the digits shown as the player starts retyping them', async () => {
      const round = await discover();
      await listen(round, 5);

      await round.type('1');

      expect(faint(round.host)).toBe('');
      expect(slots(round.host)[0]).toBe('1');
    });

    it('lands each group as its slots fill, never as the player’s timing would', async () => {
      const round = await discover();
      await listen(round, 5);

      await round.type('1415');
      await round.wait(3 * PAUSE);
      expect(words(round.host)).toEqual([]);

      await round.type('9');
      expect(words(round.host)).toEqual(['14159']);
    });

    it('waits for the player to ask for the next round, one more group', async () => {
      const round = await discover();
      await playRounds(round, 5);
      await round.wait(5 * PAUSE);
      expect(faint(round.host)).toBe('');

      await showMe(round);
      await listen(round, 10);

      expect(faint(round.host)).toBe(PI_DECIMALS.slice(0, 10));
    });

    it('shows the round again when asked before it’s retyped', async () => {
      const round = await discover();
      await listen(round, 5);
      await round.type('14');

      await showMe(round);
      await listen(round, 5);

      expect(faint(round.host)).toBe('14159');
    });

    it('counts the whole groups typed past the round shown, not the digits of a group begun', async () => {
      const round = await discover();
      await listen(round, 5);
      await round.type(PI_DECIMALS.slice(0, 12));

      await showMe(round);
      await listen(round, 15);

      expect(faint(round.host)).toBe(PI_DECIMALS.slice(0, 15));
    });

    it('plays the player’s own groups', async () => {
      const grouped = await discover(Array.from({ length: 4 }, (_, run) => by3(30, run)));
      await listen(grouped, 3);
      expect(faint(grouped.host)).toBe('141');
    });

    it('shows as many digits as the slots, past the player’s groups too', async () => {
      // Grouped by 3, the runs ending at 7: the game trusts the first group only, then groups of the default size.
      const round = await discover(Array.from({ length: 4 }, (_, run) => by3(7, run)));
      await playRounds(round, 3);
      await showMe(round);

      await listen(round, 8);

      expect(words(round.host)).toEqual(['141', '59265']);
      expect(faint(round.host)).toBe(PI_DECIMALS.slice(0, 8));
    });

    it('takes no keys while the game plays the round', async () => {
      const round = await discover();

      await round.type('3');
      await listen(round, 5);

      expect(faint(round.host)).toBe('14159');
      expect(round.host.querySelector('app-slots .wrong')).toBeNull();
    });

    it('loses on the first wrong digit, playing again from the start', async () => {
      const round = await discover();
      await playRounds(round, 5, 10);
      await showMe(round);
      await listen(round, 15);

      await round.type('13');
      expect(round.host.querySelector('.game-over')).not.toBeNull();
      await round.wait(GAME_OVER_DELAY);
      const over = dialogNamed(round.host, 'Game Over');
      expect(over.open).toBe(true);
      expect(
        Array.from(over.querySelectorAll('app-button-list button'), (button) =>
          button.textContent.trim(),
        ),
      ).toEqual(['Play Again', 'Main Menu']);

      over.querySelector<HTMLButtonElement>('app-button-list button')?.click();
      await round.wait(MEDIUM_INTERVAL);
      expect(round.host.querySelector('.game-over')).toBeNull();
      expect(slots(round.host)[0]).toBe('1');
    });

    it('pops up each checkpoint reached, starting the rounds from it once tapped', async () => {
      const round = await discover();
      const checkpoints = (): string[] =>
        Array.from(round.host.querySelectorAll('.checkpoint'), (button) =>
          button.textContent.trim(),
        );

      await playRounds(round, 5);
      expect(checkpoints()).toEqual([]);
      await showMe(round);
      await playRounds(round, 10);
      expect(checkpoints()).toEqual(['10']);

      round.host.querySelector<HTMLButtonElement>('.checkpoint')?.click();
      await round.wait(0);
      expect(checkpoints()).toEqual([]);
      expect(words(round.host)).toEqual([PI_DECIMALS.slice(0, 10)]);

      await showMe(round);
      await round.wait(MEDIUM_INTERVAL);
      expect(slots(round.host)[0]).toBe(PI_DECIMALS.charAt(10));
    });

    it('records each digit retyped at its place, in its overwriting run', async () => {
      const record = vi.spyOn(DiscoverRecorder.prototype, 'record');
      const round = await discover();

      await playRounds(round, 5);

      expect(record.mock.calls.map(([, place]) => place)).toEqual([0, 1, 2, 3, 4]);
    });

    it('stops the round while paused, playing it again from its start once resumed', async () => {
      const round = await discover();

      round.host.querySelector<HTMLButtonElement>('button[title="Pause"]')?.click();
      await round.wait(10 * MEDIUM_INTERVAL);
      expect(slots(round.host).join('')).toBe('');

      dialogNamed(round.host, 'Paused')
        .querySelector<HTMLButtonElement>('app-button-list button')
        ?.click();
      await round.wait(MEDIUM_INTERVAL);
      expect(slots(round.host)[0]).toBe('1');
    });
  });
});
