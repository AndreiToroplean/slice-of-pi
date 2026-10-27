import { DebugElement, getDebugNode } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Digit } from '../../game/pi/digit';
import { newTouchLog, TouchLog } from '../../player-data/touch-log';
import { typeKey } from '../../../testing/touch-logs';
import { RunStore } from '../../player-data/run-store';
import { Tweaks } from '../../developer-mode/tweaks';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { installPopovers, uninstallPopovers } from '../../../testing/fake-popovers';
import { button, message, OpenPage, openPage } from '../../../testing/player-data-pages';
import { YourRuns } from './your-runs';

describe('YourRuns', () => {
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
  /** The questions the player was asked to confirm, and their answer. */
  let questions: string[];
  let confirming: boolean;

  beforeEach(() => {
    questions = [];
    confirming = true;
    installPopovers();
  });

  afterEach(uninstallPopovers);

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

  function menu(host: HTMLElement): HTMLElement | null {
    // The run's own, not those of the grouping settings.
    return host.querySelector('app-page > app-dropdown-menu .dropdown');
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

  /** The items of the context menu open, if any. */
  function menuItems(host: HTMLElement): string[] {
    const open = menu(host);
    return open?.hasAttribute('data-popover-open') === true
      ? Array.from(open.children, (child) => child.textContent.trim() || '—')
      : [];
  }

  /** Opens the context menu of a run, as a long press does. */
  function openMenu(host: HTMLElement, index: number): void {
    article(host, index).dispatchEvent(new MouseEvent('contextmenu', { clientX: 40, clientY: 50 }));
  }

  function setUp(
    runs: TouchLog[] = [],
    persisted = false,
    preview = false,
    mainFormat?: number,
    developer = false,
  ): Promise<OpenPage> {
    // The page reads the runs as it opens.
    return openPage(
      YourRuns,
      (host) => host.querySelector('.runs > p:not(.message), .runs .list') !== null,
      {
        runs,
        persisted,
        preview,
        mainFormat,
        developer,
        confirm: (question) => {
          questions.push(question);
          return confirming;
        },
      },
    );
  }

  it('deletes every run once the player confirms', async () => {
    const { host, until } = await setUp([first, second]);

    button(host, 'Delete All Runs').click();
    await until(() => message(host) !== '');

    expect(questions).toEqual([
      'Delete all 2 runs kept on this device? Only a backup file can bring them back.',
    ]);
    expect(message(host)).toBe('Deleted 2 runs.');
    expect(await TestBed.inject(RunStore).touchLogs()).toEqual([]);
    expect(button(host, 'Delete All Runs').disabled).toBe(true);
  });

  it('keeps the runs when the player does not confirm', async () => {
    const { host } = await setUp([first]);
    confirming = false;

    button(host, 'Delete All Runs').click();
    await vi.waitFor(() => {
      expect(questions).toEqual([
        'Delete the run kept on this device? Only a backup file can bring it back.',
      ]);
    });

    expect(await TestBed.inject(RunStore).touchLogs()).toEqual([first]);
  });

  it('says when there are no runs to chart', async () => {
    const { host } = await setUp();

    expect(host.querySelector('.runs')?.textContent).toContain(
      'None yet: each game you play shows up here.',
    );
    expect(host.querySelector('app-run-chart')).toBeNull();
  });

  it('charts each run, oldest first, and all of them', async () => {
    const { host } = await setUp([second, first]);

    const titles = Array.from(host.querySelectorAll('h3'), (title) => title.textContent.trim());
    const format = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    expect(titles.filter((title) => title !== 'All runs')).toEqual([
      format.format(1_000),
      format.format(2_000),
    ]);
    expect(titles).toContain('All runs');
    expect(Array.from(host.querySelectorAll('.meta'), (meta) => meta.textContent)).toEqual([
      '2 digits in 0.3 s · 1 group',
      '1 digit in 0.0 s · 1 group',
    ]);
    const labels = Array.from(host.querySelectorAll('app-run-chart svg'), (svg) =>
      svg.getAttribute('aria-label'),
    );
    expect(labels).toHaveLength(3);
    expect(labels).toEqual(
      expect.arrayContaining([
        `Time per digit, ${format.format(1_000)}`,
        `Time per digit, ${format.format(2_000)}`,
        'Time per digit over all runs, recent ones weighing more, with your usual break spots',
      ]),
    );
  });

  it('lets the groups of all runs scroll, from the keyboard too', async () => {
    const { host } = await setUp([first]);

    expect(host.querySelector('.groups')?.getAttribute('tabindex')).toBe('0');
  });

  it('marks the breaks of each run on its chart, and counts its groups', async () => {
    const { host } = await setUp([grouped]);

    const chart = host.querySelector('.runs article app-run-chart');
    expect(
      Array.from(chart?.querySelectorAll('.break') ?? [], (bar) => bar.getAttribute('x1')),
    ).toEqual(['2.5', '5.5', '8.5', '11.5', '14.5', '17.5', '20.5', '23.5', '26.5']);
    expect(chart?.querySelector('.baseline')).not.toBeNull();
    expect(host.querySelector('.runs .meta')?.textContent).toBe('30 digits in 10.4 s · 10 groups');
  });

  it('shows the groups of all runs, dotted past the trust horizon', async () => {
    const { host } = await setUp(trusted);

    expect(
      Array.from(host.querySelectorAll('.groups li'), (group) => [
        group.textContent.trim(),
        group.classList.contains('unsure'),
      ]),
    ).toEqual(groupsBy3.map((digits, i) => [digits, i === 9]));
    expect(host.querySelectorAll('.summary app-run-chart .break')).toHaveLength(9);
    expect(host.querySelector('.summary app-run-chart .confidence')).not.toBeNull();
  });

  it('finds no group in a single run, outweighed by the synthetic runs', async () => {
    const { host } = await setUp([grouped]);

    expect(Array.from(host.querySelectorAll('.groups li'), (group) => group.className)).toEqual([
      'unsure',
    ]);
  });

  describe('unchecked runs', () => {
    const unchecked = { ...grouped, id: 'unchecked', checked: false };

    function groupsShown(host: HTMLElement): string[] {
      return Array.from(host.querySelectorAll('.groups li'), (group) => group.textContent.trim());
    }

    it('hides unchecked runs outside developer mode, and leaves them out of the groups', async () => {
      const { host } = await setUp([grouped, unchecked]);

      expect(host.querySelectorAll('.runs article')).toHaveLength(1);
      expect(host.querySelector('.runs .badge')).toBeNull();
      expect(groupsShown(host)).toEqual([PI_DECIMALS.slice(0, 30)]);
      expect(host.querySelector('.unchecked')).toBeNull();
    });

    it('shows unchecked runs in developer mode, marked, still leaving them out of the groups', async () => {
      const { host } = await setUp([unchecked], false, false, undefined, true);

      const article = host.querySelector('.runs article');
      expect(article?.classList).toContain('unchecked');
      expect(article?.querySelector('h3 .badge')?.textContent.trim()).toBe('Unchecked');
      expect(groupsShown(host)).toEqual([]);
    });

    it('counts unchecked runs in the groups when told to, in developer mode', async () => {
      const { host, until } = await setUp([grouped, unchecked], false, false, undefined, true);
      const checkbox = host.querySelector<HTMLInputElement>('.unchecked input[type="checkbox"]');
      expect(checkbox?.checked).toBe(false);

      expect(groupsShown(host)).toEqual([PI_DECIMALS.slice(0, 30)]);

      checkbox?.click();
      await until(() => groupsShown(host).length > 1);

      expect(groupsShown(host)).toEqual(groupsBy3);
      expect(TestBed.inject(Tweaks).values()).toEqual({ includeUnchecked: true });
    });

    it('deletes the unchecked runs once the player confirms, in developer mode', async () => {
      const { host, until } = await setUp([grouped, unchecked], false, false, undefined, true);

      button(host, 'Delete Unchecked Runs').click();
      await until(() => message(host) !== '');

      expect(questions).toEqual([
        'Delete the unchecked run? Only a backup file can bring it back.',
      ]);
      expect(message(host)).toBe('Deleted 1 unchecked run.');
      expect(await TestBed.inject(RunStore).touchLogs()).toEqual([grouped]);
      expect(button(host, 'Delete Unchecked Runs').disabled).toBe(true);
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
      return articles(host).map((run) => run.classList.contains('later'));
    }

    it('plays from after a run long pressed, from its context menu, in developer mode', async () => {
      const { host, until } = await setUp(runs, false, false, undefined, true);
      const before = groupsShown(host);

      article(host, 0).dispatchEvent(new MouseEvent('contextmenu', { clientX: 40, clientY: 50 }));
      await until(() => menu(host)?.hasAttribute('data-popover-open') === true);
      button(host, 'Play from Here').click();
      await until(() => here(host) !== undefined);

      expect(menu(host)?.hasAttribute('data-popover-open')).toBe(false);
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
      const { host, until } = await setUp(runs, false, false, undefined, true);

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
      const { host, until } = await setUp(runs, false, false, undefined, true);
      await TestBed.inject(Tweaks).setRunOrder(playedSince);
      await until(() => here(host) === 4);
      const shown = articles(host).map((run) => run.querySelector('h3')?.textContent);

      article(host, 2).dispatchEvent(new MouseEvent('contextmenu', { clientX: 40, clientY: 50 }));
      await until(() => menu(host)?.hasAttribute('data-popover-open') === true);
      button(host, 'Play from Here').click();
      await until(() => here(host) === 3);

      expect(articles(host).map((run) => run.querySelector('h3')?.textContent)).toEqual(shown);
      expect(later(host)).toEqual([false, false, false, true, true]);
    });

    it('keeps the runs in the order shown once undone, counting them all', async () => {
      const { host, until } = await setUp(runs, false, false, undefined, true);
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

    it('plays from before all the runs, from the context menu of all runs, in developer mode', async () => {
      const { host, until } = await setUp(runs, false, false, undefined, true);
      const all = host.querySelector<HTMLButtonElement>('button.aggregate');

      all?.dispatchEvent(new MouseEvent('contextmenu', { clientX: 40, clientY: 50 }));
      await until(() => menu(host)?.hasAttribute('data-popover-open') === true);
      expect(menuItems(host)).toEqual(['Play from Here']);
      button(host, 'Play from Here').click();
      await until(() => here(host) !== undefined);

      expect(here(host)).toBe(0);
      expect(later(host)).toEqual([true, true, true, true, true]);
      expect(all?.getAttribute('aria-pressed')).toBe('true');
    });

    it('draws the line after all the runs when they all come before it', async () => {
      const { host, until } = await setUp(runs, false, false, undefined, true);

      await TestBed.inject(Tweaks).setRunOrder({ ids: runs.map((run) => run.id), line: 5 });
      await until(() => here(host) !== undefined);

      expect(here(host)).toBe(5);
    });

    it('offers it only in developer mode', async () => {
      const { host } = await setUp(runs);

      openMenu(host, 1);

      expect(menuItems(host)).toEqual(['Watch Replay', 'Delete Run']);
    });
  });

  describe('the runs on the chart on top', () => {
    function tap(element: Element): void {
      element.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
      element.dispatchEvent(new PointerEvent('pointerup'));
    }

    function others(host: HTMLElement): number {
      return host.querySelectorAll('.summary .other').length;
    }

    it('adds a run tapped to the chart of all runs, and takes it off when tapped again, in developer mode', async () => {
      const { host, until } = await setUp([first, second], false, false, undefined, true);

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

    it('leaves all the runs out of the chart on top when told to, in developer mode', async () => {
      const { host, until } = await setUp([first, second], false, false, undefined, true);
      const line = (): string | null | undefined =>
        host.querySelector('.summary .line')?.getAttribute('d');
      expect(line()).not.toBe('');

      tap(article(host, 1));
      host.querySelector<HTMLButtonElement>('button.aggregate')?.click();
      await until(() => line() === '');

      expect(others(host)).toBe(1);
      expect(host.querySelector('.summary h3')?.textContent.trim()).toBe('1 run');
    });

    it('keeps the chart on top to all the runs outside developer mode', async () => {
      const { host } = await setUp([first, second]);

      tap(article(host, 0));

      expect(others(host)).toBe(0);
      expect(article(host, 0).getAttribute('aria-pressed')).toBeNull();
    });
  });

  describe("a run's context menu", () => {
    it("opens the run's replay", async () => {
      const { host } = await setUp([first, second]);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      openMenu(host, 1);
      button(host, 'Watch Replay').click();

      expect(navigate).toHaveBeenCalledWith(['/runs', 'b', 'replay']);
    });

    it('deletes the run once the player confirms', async () => {
      const { host, until } = await setUp([first, second]);

      openMenu(host, 0);
      button(host, 'Delete Run').click();
      await until(() => message(host) !== '');

      expect(questions).toEqual(['Delete this run? Only a backup file can bring it back.']);
      expect(message(host)).toBe('Deleted the run.');
      expect(await TestBed.inject(RunStore).touchLogs()).toEqual([second]);
      expect(articles(host)).toHaveLength(1);
    });

    it('keeps the run when the player does not confirm', async () => {
      const { host } = await setUp([first, second]);
      confirming = false;

      openMenu(host, 0);
      button(host, 'Delete Run').click();
      await vi.waitFor(() => {
        expect(questions).toHaveLength(1);
      });

      expect(await TestBed.inject(RunStore).touchLogs()).toEqual([first, second]);
    });

    it('sets playing from a run apart from deleting it, in developer mode', async () => {
      const { host } = await setUp([first], false, false, undefined, true);

      openMenu(host, 0);

      expect(menuItems(host)).toEqual(['Watch Replay', 'Delete Run', '—', 'Play from Here']);
    });

    it('opens from the keyboard too', async () => {
      const { host } = await setUp([first]);

      expect(article(host, 0).getAttribute('tabindex')).toBe('0');
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

    it('moves a run with its handle, in developer mode', async () => {
      const { host, until } = await setUp([first, second, third], false, false, undefined, true);

      press(handles(host)[0], 'ArrowDown');
      await until(() => titles(host)[0] === format.format(2_000));

      expect(titles(host)).toEqual([2_000, 1_000, 3_000].map((time) => format.format(time)));
      expect(TestBed.inject(Tweaks).values()).toEqual({
        runOrder: { ids: ['b', 'a', 'third'] },
      });
    });

    it('moves a run dropped somewhere else at once, across the line too', async () => {
      const { host, until } = await setUp([first, second, third], false, false, undefined, true);
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
      const { host, until } = await setUp([first, second, third], false, false, undefined, true);
      await TestBed.inject(Tweaks).setRunOrder({ ids: ['a', 'b', 'third'], line: 2 });
      await until(() => here(host) === 2);
      const later = (): boolean[] => articles(host).map((run) => run.classList.contains('later'));
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

    it('shows the runs in the order they were played outside developer mode, all counted', async () => {
      const { host, until } = await setUp([first, second, third]);
      await TestBed.inject(Tweaks).setRunOrder({ ids: ['third', 'b', 'a'], line: 1 });
      await until(() => true);

      expect(titles(host)).toEqual([1_000, 2_000, 3_000].map((time) => format.format(time)));
      expect(here(host)).toBeUndefined();
    });

    it('puts the runs back in the order they were played in', async () => {
      const { host, until } = await setUp([first, second, third], false, false, undefined, true);
      expect(button(host, 'Reorder Runs Chronologically').disabled).toBe(true);
      await TestBed.inject(Tweaks).setRunOrder({ ids: ['third', 'b', 'a'] });
      await until(() => !button(host, 'Reorder Runs Chronologically').disabled);

      button(host, 'Reorder Runs Chronologically').click();
      await until(() => button(host, 'Reorder Runs Chronologically').disabled);

      expect(titles(host)).toEqual([1_000, 2_000, 3_000].map((time) => format.format(time)));
      expect(TestBed.inject(Tweaks).values()).toEqual({});
    });

    it('keeps the line under as many runs when putting them back in the order they were played in', async () => {
      const { host, until } = await setUp([first, second, third], false, false, undefined, true);
      await TestBed.inject(Tweaks).setRunOrder({ ids: ['third', 'b', 'a'], line: 1 });
      await until(() => here(host) === 1);

      button(host, 'Reorder Runs Chronologically').click();
      await until(() => button(host, 'Reorder Runs Chronologically').disabled);

      expect(titles(host)).toEqual([1_000, 2_000, 3_000].map((time) => format.format(time)));
      expect(here(host)).toBe(1);
    });

    it('offers it only in developer mode', async () => {
      const { host } = await setUp([first, second]);

      expect(handles(host)).toEqual([]);
      expect(() => button(host, 'Reorder Runs Chronologically')).toThrow();
    });
  });

  it('offers the grouping settings only in developer mode', async () => {
    const { host } = await setUp([grouped]);

    expect(host.querySelector('app-grouping-settings-panel')).toBeNull();
  });

  it('follows the grouping settings as they change', async () => {
    const { host, until } = await setUp(trusted, false, false, undefined, true);
    const slider = host.querySelector<HTMLInputElement>('#setting-level');

    if (slider === null) {
      throw new Error('No slider');
    }
    slider.value = '0.99';
    slider.dispatchEvent(new Event('input'));
    await until(() => host.querySelectorAll('.groups li.unsure').length === 10);

    expect(host.querySelectorAll('.groups li:not(.unsure)')).toHaveLength(0);
  });

  it('spans every chart over the places of the longest run', async () => {
    const { host } = await setUp([first, second]);

    const viewBoxes = Array.from(host.querySelectorAll('app-run-chart svg'), (svg) =>
      svg.getAttribute('viewBox'),
    );
    expect(viewBoxes).toEqual(['0 0 1 100', '0 0 1 100', '0 0 1 100']);
    expect(
      Array.from(host.querySelectorAll('.summary .axis span'), (span) => span.textContent),
    ).toEqual(['Place 1', 'Place 2']);
  });

  it('shows what the break model makes of a place tapped on a chart, in developer mode', async () => {
    const { host, until } = await setUp(trusted, false, false, undefined, true);
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

  it('zooms the charts of the runs into the places zoomed into on the chart of all runs', async () => {
    const { host, until } = await setUp(trusted);
    const chart = host.querySelector<HTMLElement>('.summary app-run-chart');
    if (chart === null) {
      throw new Error('No chart');
    }
    chart.getBoundingClientRect = () => new DOMRect(0, 0, 290, 50);
    // Halving the 29 places shown, around the first.
    chart.dispatchEvent(
      new WheelEvent('wheel', { clientX: 0, deltaY: Math.log(0.5) / 0.002, bubbles: true }),
    );
    await until(
      () => host.querySelector('.runs app-run-chart svg')?.getAttribute('viewBox') !== '0 0 29 100',
    );

    expect(
      Array.from(host.querySelectorAll('app-run-chart svg'), (svg) => svg.getAttribute('viewBox')),
    ).toEqual(Array<string>(trusted.length + 1).fill('0 0 14.5 100'));
    expect(
      Array.from(host.querySelectorAll('.summary .axis span'), (span) => span.textContent),
    ).toEqual(['Place 1', 'Place 16']);
  });

  it('hides the marks of the chart of all runs under a key pressed', async () => {
    const { host, until } = await setUp(trusted);
    const breaks = () => host.querySelectorAll('.summary app-run-chart line.break').length;
    expect(breaks()).toBeGreaterThan(0);

    const summary = host.querySelector<HTMLElement>('.summary');
    if (summary === null) {
      throw new Error('No chart of all runs');
    }
    button(summary, 'Usual break').click();
    await until(() => breaks() === 0);
    expect(host.querySelector('.summary app-run-chart path.line')?.getAttribute('d')).not.toBe('');
  });
});
