import { DebugElement, getDebugNode } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Digit } from '../../game/pi/digit';
import { newTouchLog, TouchLog } from '../../player-data/touch-log';
import { typeKey } from '../../../testing/touch-logs';
import { Tweaks } from '../../developer-mode/tweaks';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { menuItem, menuItems, openMenu } from '../../../testing/menus';
import { button, OpenPage, openPage } from '../../../testing/player-data-pages';
import { ModelTuning } from './model-tuning';

describe('ModelTuning', () => {
  const first = typeKey(typeKey(newTouchLog('a', 1_000), '1', 0), '4', 250);
  const second = typeKey(newTouchLog('b', 2_000), '1', 0);
  // Groups of 3: about 200 ms between digits, 700 ms before every fourth.
  const grouped = Array.from(PI_DECIMALS.slice(0, 30)).reduce(
    (run, digit, i) =>
      typeKey(
        run,
        digit as Digit,
        i === 0 ? 0 : (run.touches.at(-1)?.time ?? 0) + (i % 3 ? ([180, 230][i % 2] ?? 0) : 700),
      ),
    newTouchLog('c', 3_000),
  );
  const groupsBy3 = PI_DECIMALS.slice(0, 30).match(/.../g) ?? [];
  /** Enough runs grouped by 3 for the game to trust their groups. */
  const trusted = ['d', 'e', 'f', 'g'].map((id, i) => ({ ...grouped, id, startedAt: 4_000 + i }));

  function articles(host: HTMLElement): HTMLElement[] {
    return Array.from(host.querySelectorAll<HTMLElement>('.runs article'));
  }

  function article(host: HTMLElement, index: number): HTMLElement {
    const found = articles(host)[index];
    if (found === undefined) {
      throw new Error(`No run ${String(index)}`);
    }
    return found;
  }

  /** Where the "You are here" line is among the runs: how many come before it. */
  function here(host: HTMLElement): number | undefined {
    const rows = Array.from(host.querySelectorAll('.runs .list > *'));
    const line = rows.findIndex((row) => row.classList.contains('here'));
    return line === -1 ? undefined : line;
  }

  /** The titles of the runs, in the order shown. */
  function titles(host: HTMLElement): string[] {
    return articles(host).map((run) => run.querySelector('h3')?.textContent.trim() ?? '');
  }

  /** Opens the context menu of a run, as a long press does. */
  async function longPress({ host, until }: OpenPage, index: number): Promise<void> {
    article(host, index).dispatchEvent(new MouseEvent('contextmenu', { clientX: 40, clientY: 50 }));
    await until(() => openMenu() !== null);
  }

  /** The item named so of the overflow menu of the grouping settings, opened if it isn't. */
  async function overflowItem({ host, until }: OpenPage, name: string): Promise<HTMLElement> {
    if (openMenu() === null) {
      host.querySelector<HTMLButtonElement>('.bar button[title="More"]')?.click();
      await until(() => openMenu() !== null);
    }
    return menuItem(name);
  }

  function setUp(runs: TouchLog[] = []): Promise<OpenPage> {
    // The page reads the runs as it opens, in developer mode, which it's for.
    return openPage(
      ModelTuning,
      (host) => host.querySelector('.runs > p:not(.message), .runs .list') !== null,
      {
        runs,
        developer: true,
      },
    );
  }

  describe('unchecked runs', () => {
    const unchecked = { ...grouped, id: 'unchecked', checked: false };

    function groupsShown(host: HTMLElement): string[] {
      return Array.from(host.querySelectorAll('.groups li'), (group) => group.textContent.trim());
    }

    it('shows unchecked runs too, marked, still leaving them out of the groups', async () => {
      const { host } = await setUp([unchecked]);

      const article = host.querySelector('.runs article');
      expect(host.querySelector('.runs app-run-card')?.classList).toContain('unchecked');
      expect(article?.querySelector('h3 .badge')?.textContent.trim()).toBe('Unchecked');
      expect(groupsShown(host)).toEqual([]);
    });

    it('counts unchecked runs in the groups when told to', async () => {
      const page = await setUp([grouped, unchecked]);
      const { host, until } = page;
      const toggle = await overflowItem(page, 'Count Unchecked Runs');
      expect(toggle.getAttribute('aria-checked')).toBe('false');

      expect(groupsShown(host)).toEqual([PI_DECIMALS.slice(0, 30)]);

      toggle.click();
      await until(() => groupsShown(host).length > 1);
      expect((await overflowItem(page, 'Count Unchecked Runs')).getAttribute('aria-checked')).toBe(
        'true',
      );

      expect(groupsShown(host)).toEqual(groupsBy3);
      expect(TestBed.inject(Tweaks).values()).toEqual({ includeUnchecked: true });
    });
  });

  describe('playing from a run', () => {
    // A run grouped by 3, one to play from, then three grouped by 3 played after it.
    const from = { ...grouped, id: 'from', startedAt: 3_001 };
    const runs: TouchLog[] = [grouped, from, ...trusted.slice(0, 3)];
    /** Playing from before the run to play from, with the runs after it played since. */
    const playedSince = { ids: ['c', 'from'], line: 1 };

    function groupsShown(host: HTMLElement): string[] {
      return Array.from(host.querySelectorAll('.groups li'), (group) => group.textContent.trim());
    }

    function later(host: HTMLElement): boolean[] {
      return articles(host).map(
        (run) => run.closest('app-run-card')?.classList.contains('later') === true,
      );
    }

    it('plays from after a run long pressed, from its context menu', async () => {
      const page = await setUp(runs);
      const { host, until } = page;
      const before = groupsShown(host);

      await longPress(page, 0);
      menuItem('Play from Here').click();
      await until(() => here(host) !== undefined);

      expect(openMenu()).toBeNull();
      expect(TestBed.inject(Tweaks).values()).toEqual({
        runOrder: { ids: ['c', 'from', 'd', 'e', 'f'], line: 1 },
      });
      expect(here(host)).toBe(1);
      expect(host.querySelector('.here')?.textContent).toContain('You are here');
      expect(later(host)).toEqual([false, true, true, true, true]);
      expect(host.querySelector('.summary h3')?.textContent.trim()).toBe('Runs before here');
      expect(article(host, 1).querySelector('.meta')?.textContent).toContain('1 group');
      expect(before).toEqual(groupsBy3);
      expect(groupsShown(host)).toEqual([PI_DECIMALS.slice(0, 30)]);
    });

    it('puts the runs played since just before the line, and counts them', async () => {
      const { host, until } = await setUp(runs);

      await TestBed.inject(Tweaks).setRunOrder(playedSince);
      await until(() => here(host) !== undefined);

      expect(here(host)).toBe(4);
      expect(article(host, 4).querySelector('h3')?.textContent).toContain(
        new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
          from.startedAt,
        ),
      );
      expect(later(host)).toEqual([false, false, false, false, true]);
      expect(groupsShown(host)).toEqual(groupsBy3);
    });

    it('keeps the runs in the order shown when playing from a run while already playing from one', async () => {
      const page = await setUp(runs);
      const { host, until } = page;
      await TestBed.inject(Tweaks).setRunOrder(playedSince);
      await until(() => here(host) === 4);
      const shown = articles(host).map((run) => run.querySelector('h3')?.textContent);

      await longPress(page, 2);
      menuItem('Play from Here').click();
      await until(() => here(host) === 3);

      expect(articles(host).map((run) => run.querySelector('h3')?.textContent)).toEqual(shown);
      expect(later(host)).toEqual([false, false, false, true, true]);
    });

    it('keeps the runs in the order shown once undone, counting them all', async () => {
      const { host, until } = await setUp(runs);
      await TestBed.inject(Tweaks).setRunOrder(playedSince);
      await until(() => here(host) !== undefined);
      const shown = articles(host).map((run) => run.querySelector('h3')?.textContent);

      host.querySelector<HTMLButtonElement>('.here .undo')?.click();
      await until(() => here(host) === undefined);

      expect(TestBed.inject(Tweaks).values()).toEqual({
        runOrder: { ids: ['c', 'd', 'e', 'f', 'from'] },
      });
      expect(articles(host).map((run) => run.querySelector('h3')?.textContent)).toEqual(shown);
      expect(later(host)).toEqual([false, false, false, false, false]);
      expect(host.querySelector('.summary h3')?.textContent.trim()).toBe('All runs');
    });

    it('plays from before all the runs, from the context menu of all runs', async () => {
      const { host, until } = await setUp(runs);
      const all = host.querySelector<HTMLButtonElement>('.aggregate > button[aria-pressed]');

      all?.dispatchEvent(new MouseEvent('contextmenu', { clientX: 40, clientY: 50 }));
      await until(() => openMenu() !== null);
      expect(menuItems()).toEqual(['Play from Here']);
      menuItem('Play from Here').click();
      await until(() => here(host) !== undefined);

      expect(here(host)).toBe(0);
      expect(later(host)).toEqual([true, true, true, true, true]);
      expect(all?.getAttribute('aria-pressed')).toBe('true');
    });

    it('plays from before all the runs, from the ⋮ of all runs', async () => {
      const { host, until } = await setUp(runs);

      host.querySelector<HTMLButtonElement>('.aggregate .more')?.click();
      await until(() => openMenu() !== null);
      expect(menuItems()).toEqual(['Play from Here']);
      menuItem('Play from Here').click();
      await until(() => here(host) !== undefined);

      expect(here(host)).toBe(0);
    });

    it('draws the line after all the runs when they all come before it', async () => {
      const { host, until } = await setUp(runs);

      await TestBed.inject(Tweaks).setRunOrder({ ids: runs.map((run) => run.id), line: 5 });
      await until(() => here(host) !== undefined);

      expect(here(host)).toBe(5);
    });
  });

  describe('the runs on the chart on top', () => {
    function tap(element: HTMLElement): void {
      element.click();
    }

    function others(host: HTMLElement): number {
      return host.querySelectorAll('.summary .other').length;
    }

    it('adds a run tapped to the chart of all runs, and takes it off when tapped again', async () => {
      const { host, until } = await setUp([first, second]);

      tap(article(host, 0));
      await until(() => others(host) === 1);
      tap(article(host, 1));
      await until(() => others(host) === 2);
      expect(host.querySelector('.summary h3')?.textContent.trim()).toBe('All runs and 2 runs');

      tap(article(host, 0));
      await until(() => others(host) === 1);
      expect(article(host, 0).getAttribute('aria-pressed')).toBe('false');
      expect(article(host, 1).getAttribute('aria-pressed')).toBe('true');
    });

    it('leaves all the runs out of the chart on top when told to', async () => {
      const { host, until } = await setUp([first, second]);
      const line = (): string | null | undefined =>
        host.querySelector('.summary .line')?.getAttribute('d');
      expect(line()).not.toBe('');

      tap(article(host, 1));
      host.querySelector<HTMLButtonElement>('.aggregate > button[aria-pressed]')?.click();
      await until(() => line() === '');

      expect(others(host)).toBe(1);
      expect(host.querySelector('.summary h3')?.textContent.trim()).toBe('1 run');
    });
  });

  describe("a run's context menu", () => {
    it('sets playing from a run apart from watching its replay, and never deletes it', async () => {
      await longPress(await setUp([first]), 0);

      expect(
        Array.from(openMenu()?.children ?? [], (child) => child.textContent.trim() || '—'),
      ).toEqual(['Watch Replay', '—', 'Play from Here']);
    });
  });

  describe('reordering the runs', () => {
    const third = { ...grouped, id: 'third', startedAt: 3_000 };
    const format = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

    function handles(host: HTMLElement): HTMLButtonElement[] {
      return Array.from(host.querySelectorAll<HTMLButtonElement>('.runs .handle'));
    }

    function press(handle: HTMLButtonElement | undefined, key: string): void {
      handle?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }

    it('moves a run with its handle', async () => {
      const { host, until } = await setUp([first, second, third]);

      press(handles(host)[0], 'ArrowDown');
      await until(() => titles(host)[0] === format.format(2_000));

      expect(titles(host)).toEqual([2_000, 1_000, 3_000].map((time) => format.format(time)));
      expect(TestBed.inject(Tweaks).values()).toEqual({
        runOrder: { ids: ['b', 'a', 'third'] },
      });
    });

    it('moves a run dropped somewhere else at once, across the line too', async () => {
      const { host, until } = await setUp([first, second, third]);
      await TestBed.inject(Tweaks).setRunOrder({ ids: ['a', 'b', 'third'], line: 2 });
      await until(() => here(host) === 2);

      // Dropping the last run, under the line, at the top.
      (getDebugNode(host.querySelector('.list')) as DebugElement | null)?.triggerEventHandler(
        'cdkDropListDropped',
        {
          previousIndex: 3,
          currentIndex: 0,
        },
      );

      // At once, before the page is drawn again.
      expect(here(host)).toBe(3);
      expect(titles(host)).toEqual([3_000, 1_000, 2_000].map((time) => format.format(time)));
      expect(TestBed.inject(Tweaks).values()).toEqual({
        runOrder: { ids: ['third', 'a', 'b'], line: 3 },
      });
    });

    it('moves a run across the line, so that it counts or not', async () => {
      const { host, until } = await setUp([first, second, third]);
      await TestBed.inject(Tweaks).setRunOrder({ ids: ['a', 'b', 'third'], line: 2 });
      await until(() => here(host) === 2);
      const later = (): boolean[] =>
        articles(host).map(
          (run) => run.closest('app-run-card')?.classList.contains('later') === true,
        );
      expect(later()).toEqual([false, false, true]);

      press(handles(host)[2], 'ArrowUp');
      await until(() => here(host) === 3);

      expect(titles(host)).toEqual([1_000, 2_000, 3_000].map((time) => format.format(time)));
      expect(later()).toEqual([false, false, false]);

      press(handles(host)[1], 'ArrowDown');
      await until(() => titles(host)[2] === format.format(2_000));
      press(handles(host)[2], 'ArrowDown');
      await until(() => here(host) === 2);

      expect(titles(host)).toEqual([1_000, 3_000, 2_000].map((time) => format.format(time)));
      expect(later()).toEqual([false, false, true]);
      expect(TestBed.inject(Tweaks).values()).toEqual({
        runOrder: { ids: ['a', 'third', 'b'], line: 2 },
      });
    });

    it('puts the runs back in the order they were played in', async () => {
      const page = await setUp([first, second, third]);
      const { host, until } = page;
      const reorder = await overflowItem(page, 'Reorder Runs Chronologically');
      expect(reorder.getAttribute('aria-disabled')).toBe('true');
      await TestBed.inject(Tweaks).setRunOrder({ ids: ['third', 'b', 'a'] });
      await until(() => reorder.getAttribute('aria-disabled') === null);

      reorder.click();
      await until(() => openMenu() === null);
      expect(
        (await overflowItem(page, 'Reorder Runs Chronologically')).getAttribute('aria-disabled'),
      ).toBe('true');

      expect(titles(host)).toEqual([1_000, 2_000, 3_000].map((time) => format.format(time)));
      expect(TestBed.inject(Tweaks).values()).toEqual({});
    });

    it('keeps the line under as many runs when putting them back in the order they were played in', async () => {
      const page = await setUp([first, second, third]);
      const { host, until } = page;
      await TestBed.inject(Tweaks).setRunOrder({ ids: ['third', 'b', 'a'], line: 1 });
      await until(() => here(host) === 1);

      (await overflowItem(page, 'Reorder Runs Chronologically')).click();
      await until(() => titles(host)[0] === format.format(1_000));

      expect(titles(host)).toEqual([1_000, 2_000, 3_000].map((time) => format.format(time)));
      expect(here(host)).toBe(1);
    });
  });

  it('shows how confident the break model is, on the chart of all runs', async () => {
    const { host } = await setUp(trusted);

    expect(host.querySelector('.summary app-run-chart .confidence')).not.toBeNull();
  });

  it('offers no way to delete runs', async () => {
    const { host } = await setUp([grouped, { ...grouped, id: 'unchecked', checked: false }]);

    expect(
      Array.from(host.querySelectorAll('button'), (button) => button.textContent.trim()).filter(
        (label) => label.startsWith('Delete'),
      ),
    ).toEqual([]);
  });

  it('brings back the game’s values of the hyperparameters of the break model picked', async () => {
    const { host, until } = await setUp(trusted);
    const reset = button(host, 'Reset All');
    const slider = host.querySelector<HTMLInputElement>('#setting-window');
    if (slider === null) {
      throw new Error('No slider');
    }
    expect(reset.disabled).toBe(true);

    slider.value = '11';
    slider.dispatchEvent(new Event('input'));
    await until(() => !reset.disabled);
    reset.click();
    await until(() => reset.disabled);

    expect(TestBed.inject(Tweaks).values().grouping).toBeUndefined();
    expect(slider.value).toBe('21');
  });

  it('follows the grouping settings as they change', async () => {
    const { host, until } = await setUp(trusted);
    const slider = host.querySelector<HTMLInputElement>('#setting-level');

    if (slider === null) {
      throw new Error('No slider');
    }
    slider.value = '0.99';
    slider.dispatchEvent(new Event('input'));
    await until(() => host.querySelectorAll('.groups li.unsure').length === 10);

    expect(host.querySelectorAll('.groups li:not(.unsure)')).toHaveLength(0);
  });

  it('shows what the break model makes of a place tapped on a chart', async () => {
    const { host, until } = await setUp(trusted);
    const chart = host.querySelector<SVGElement>('.summary app-run-chart svg');
    if (chart === null) {
      throw new Error('No chart');
    }
    // 30 places across 290 pixels: 10 to a place, the boundary before index 6 at 55.
    chart.getBoundingClientRect = () => new DOMRect(0, 0, 290, 50);
    chart.dispatchEvent(new MouseEvent('pointerup', { clientX: 56 }));
    button(host, 'Place').click();
    const place = () => host.querySelector('app-place-perspective');
    await until(() => place()?.querySelector('h3')?.textContent.includes('Places 6 | 7') === true);

    expect(place()?.closest<HTMLElement>('[role="tabpanel"]')?.hidden).toBe(false);
    expect(place()?.querySelector('.verdict')?.textContent.trim()).toBe('Break');
    expect(place()?.querySelectorAll('tbody tr')).toHaveLength(trusted.length);
  });
});
