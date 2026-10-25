import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { IDBFactory } from 'fake-indexeddb';
import { KeypadTouch } from '../../game/layers/keypad-layout';
import { INDEXED_DB, RunStore } from '../../player-data/run-store';
import { addTouch, newTouchLog, TouchLog } from '../../player-data/touch-log';
import { PLAY_WITH_MERCURY } from '../../../testing/game-break-model';
import { installPopovers, uninstallPopovers } from '../../../testing/fake-popovers';
import { MARK_DURATION, Replay, TAIL } from './replay';

@Component({ template: '' })
class Runs {}

/** A pause clearly longer than the time between digits, in milliseconds. */
const PAUSE = 2000;

describe('Replay', () => {
  /** 1, 4 and 1 touched, a miss, a wrong 9 deleted, then a pause, and 5 from the keyboard. */
  const touches: [KeypadTouch, number][] = [
    [{ key: '1', x: -0.75, y: 1.25 }, 0],
    [{ key: '4', x: -1, y: 0 }, 200],
    [{ key: '1', x: -1, y: 1 }, 400],
    [{ key: null, x: 2.5, y: 0 }, 500],
    [{ key: '9', x: 1, y: -1 }, 600],
    [{ key: 'backspace', x: 1, y: 2 }, 800],
    [{ key: '5' }, 800 + PAUSE],
  ];
  const log = touches.reduce(
    (touched, [touch, time]) => addTouch(touched, touch, time),
    newTouchLog('replayed', 1_760_000_000_000),
  );

  beforeEach(() => {
    installPopovers();
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    TestBed.configureTestingModule({
      providers: [
        PLAY_WITH_MERCURY,
        provideRouter([
          { path: 'runs/:id/replay', component: Replay },
          { path: 'runs', component: Runs },
        ]),
        { provide: INDEXED_DB, useValue: new IDBFactory() },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    uninstallPopovers();
  });

  async function setUp(
    logs: TouchLog[] = [log],
    id = 'replayed',
  ): Promise<{ host: HTMLElement; harness: RouterTestingHarness }> {
    const store = TestBed.inject(RunStore);
    for (const stored of logs) {
      await store.save(stored);
    }
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/runs/${id}/replay`);
    await store.touchLogs();
    await harness.fixture.whenStable();
    const host = harness.routeNativeElement;
    if (host === null) {
      throw new Error('No replay');
    }
    return { host, harness };
  }

  function control(host: HTMLElement, label: string): HTMLButtonElement {
    const found = host.querySelector<HTMLButtonElement>(
      `button:is([title="${label}"], [aria-label="${label}"])`,
    );
    if (found === null) {
      throw new Error(`No ${label} button`);
    }
    return found;
  }

  function timeline(host: HTMLElement): HTMLInputElement {
    const found = host.querySelector<HTMLInputElement>('.timeline');
    if (found === null) {
      throw new Error('No timeline');
    }
    return found;
  }

  /** What the play screen shows: the digits typed, those in the slots, the words, keys pressed, and marks. */
  function shown(host: HTMLElement): {
    readonly summary: string | undefined;
    readonly slots: string;
    readonly words: string[];
    readonly pressed: string[];
    readonly marks: number;
  } {
    return {
      summary: host.querySelector('app-typed-digits .visually-hidden')?.textContent.trim(),
      slots: Array.from(host.querySelectorAll('app-slots .slot'), (slot) =>
        slot.textContent.trim(),
      ).join(''),
      words: Array.from(host.querySelectorAll('app-typed-digits .word'), (word) =>
        word.textContent.replace(/\s/g, ''),
      ),
      pressed: Array.from(
        host.querySelectorAll<HTMLElement>('.key.pressed'),
        (key) => key.dataset['key'] ?? '',
      ),
      marks: host.querySelectorAll('.mark').length,
    };
  }

  /** The items of the menu of speeds, if open. */
  function menuItems(host: HTMLElement): string[] {
    const menu = host.querySelector('.dropdown');
    return menu?.hasAttribute('data-popover-open') === true
      ? Array.from(menu.children, (item) => item.textContent.trim())
      : [];
  }

  async function click(harness: RouterTestingHarness, button: HTMLButtonElement): Promise<void> {
    button.click();
    await harness.fixture.whenStable();
  }

  /** Lets the replay play for `milliseconds` of the page's time, frame by frame. */
  async function play(harness: RouterTestingHarness, milliseconds: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(milliseconds);
    await harness.fixture.whenStable();
  }

  it('shows the play screen, with nothing typed yet, and a back button rather than a pause button', async () => {
    const { host } = await setUp();

    expect(shown(host)).toMatchObject({ summary: 'No digits typed yet.', slots: '', marks: 0 });
    expect(host.querySelector('app-pause')).toBeNull();
    expect(host.querySelector('.back')?.getAttribute('title')).toBe('Back');
    expect(timeline(host).max).toBe(String(800 + PAUSE + TAIL));
  });

  it('steps through the touches while paused, each marked, its key pressed', async () => {
    const { host, harness } = await setUp();
    expect(control(host, 'Previous touch').disabled).toBe(true);

    await click(harness, control(host, 'Next touch'));
    expect(shown(host)).toMatchObject({
      summary: '1 digits typed, the last one is 1.',
      pressed: ['1'],
      marks: 1,
    });

    for (let i = 0; i < 3; i++) {
      await click(harness, control(host, 'Next touch'));
    }
    // A miss: marked, but no key pressed.
    expect(shown(host)).toMatchObject({ slots: '141', pressed: [], marks: 4 });

    await click(harness, control(host, 'Next touch'));
    expect(shown(host)).toMatchObject({ slots: '1419', pressed: ['9'] });
    await click(harness, control(host, 'Next touch'));
    expect(shown(host)).toMatchObject({ slots: '141', pressed: ['backspace'] });

    await click(harness, control(host, 'Previous touch'));
    expect(shown(host)).toMatchObject({ slots: '1419', pressed: ['9'] });
    expect(timeline(host).value).toBe('600');
  });

  it('plays the touches at their time, at the speed picked, the groups ending as they did', async () => {
    const { host, harness } = await setUp();
    await click(harness, control(host, 'Speed ×1'));
    expect(menuItems(host)).toEqual(['×⅛', '×¼', '×½', '×1', '×2', '×4', '×8']);
    const double = Array.from(host.querySelectorAll<HTMLButtonElement>('.dropdown button')).find(
      (item) => item.textContent.trim() === '×2',
    );
    if (double !== undefined) {
      await click(harness, double);
    }
    expect(control(host, 'Speed ×2')).toBeTruthy();

    await click(harness, control(host, 'Play'));
    expect(control(host, 'Next touch').disabled).toBe(true);
    // 320 ms at twice the speed: up to the wrong 9, at 600 ms of the run.
    await play(harness, 320);
    expect(shown(host)).toMatchObject({ slots: '1419' });

    await play(harness, 930);
    expect(shown(host)).toMatchObject({ words: ['141'], slots: '' });
    await play(harness, 1000);
    expect(shown(host)).toMatchObject({ summary: '4 digits typed, the last one is 5.' });

    await play(harness, TAIL);
    expect(control(host, 'Play').disabled).toBe(false);
    expect(timeline(host).value).toBe(timeline(host).max);
  });

  it('shows a key pressed only for a moment of the run, and the marks fading away', async () => {
    const { host, harness } = await setUp();

    await click(harness, control(host, 'Play'));
    await play(harness, 100);
    expect(shown(host)).toMatchObject({ pressed: ['1'], marks: 1 });
    await play(harness, 80);
    expect(shown(host)).toMatchObject({ pressed: [], marks: 1 });
    expect(Number(host.querySelector<HTMLElement>('.mark')?.style.opacity)).toBeLessThan(1);

    // The first touch faded away; the others, up to 800 ms of the run, still show.
    await play(harness, MARK_DURATION);
    expect(shown(host).marks).toBe(5);
  });

  it('moves along the timeline, back and forth', async () => {
    const { host, harness } = await setUp();

    timeline(host).value = '450';
    timeline(host).dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    expect(shown(host)).toMatchObject({ slots: '141' });

    timeline(host).value = '250';
    timeline(host).dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    expect(shown(host)).toMatchObject({ slots: '14' });
  });

  it('takes no keys from the player, and records nothing', async () => {
    const { host, harness } = await setUp();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
    await click(harness, control(host, 'Play'));
    await play(harness, 800 + PAUSE + TAIL);

    expect(shown(host).summary).toBe('4 digits typed, the last one is 5.');
    expect(await TestBed.inject(RunStore).touchLogs()).toEqual([log]);
  });

  it('goes back to the runs', async () => {
    const { host, harness } = await setUp();

    await click(harness, control(host, 'Back'));

    expect(TestBed.inject(Router).url).toBe('/runs');
  });

  describe('for a game stopped to replay its run', () => {
    async function setUpStopped(menuBehind: boolean): Promise<HTMLElement> {
      await TestBed.inject(RunStore).save(log);
      const harness = await RouterTestingHarness.create();
      await TestBed.inject(Router).navigate(['/runs', 'replayed', 'replay'], {
        state: { menuBehind },
      });
      await TestBed.inject(RunStore).touchLogs();
      await harness.fixture.whenStable();
      const host = harness.routeNativeElement;
      if (host === null) {
        throw new Error('No replay');
      }
      return host;
    }

    it('goes back to the main menu, just behind it', async () => {
      const host = await setUpStopped(true);
      const back = vi.spyOn(TestBed.inject(Location), 'back').mockReturnValue(undefined);

      control(host, 'Back').click();

      expect(back).toHaveBeenCalledOnce();
    });

    it('puts the main menu in its place when the menu is not behind it', async () => {
      const host = await setUpStopped(false);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      control(host, 'Back').click();

      expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
    });
  });

  it('says when the run is no longer kept', async () => {
    const { host } = await setUp([], 'gone');

    expect(host.querySelector('.missing')?.textContent).toContain('no longer kept');
    expect(host.querySelector('app-play')).toBeNull();
  });
});
