import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Digit } from '../../game/pi/digit';
import { newTouchLog, TouchLog } from '../../player-data/touch-log';
import { typeKey } from '../../../testing/touch-logs';
import { RunStore } from '../../player-data/run-store';
import { Tweaks } from '../../developer-mode/tweaks';
import { PI_DECIMALS } from '../../game/pi/pi-decimals';
import { installPopovers, uninstallPopovers } from '../../../testing/fake-popovers';
import { button, message, OpenPage, openPage, text } from '../../../testing/player-data-pages';
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
      (host) => host.querySelector('.runs > p:not(.message), .runs app-run-card') !== null,
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

  it('shows the groups of all runs, dotted past the trust horizon, but not how confident they are', async () => {
    const { host } = await setUp(trusted);

    expect(
      Array.from(host.querySelectorAll('.groups li'), (group) => [
        group.textContent.trim(),
        group.classList.contains('unsure'),
      ]),
    ).toEqual(groupsBy3.map((digits, i) => [digits, i === 9]));
    expect(host.querySelectorAll('.summary app-run-chart .break')).toHaveLength(9);
    expect(host.querySelector('.summary app-run-chart .confidence')).toBeNull();
    expect(text(host)).not.toContain('Confidence trend');
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

    it('hides unchecked runs, and leaves them out of the groups', async () => {
      const { host } = await setUp([grouped, unchecked]);

      expect(host.querySelectorAll('.runs article')).toHaveLength(1);
      expect(host.querySelector('.runs .badge')).toBeNull();
      expect(groupsShown(host)).toEqual([PI_DECIMALS.slice(0, 30)]);
      expect(host.querySelector('.unchecked')).toBeNull();
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

    it("opens from the run's ⋮ too, for its run", async () => {
      const { host } = await setUp([first, second]);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      host.querySelectorAll<HTMLButtonElement>('.runs .more')[1]?.click();
      expect(menuItems(host)).toEqual(['Watch Replay', 'Delete Run']);
      button(host, 'Watch Replay').click();

      expect(navigate).toHaveBeenCalledWith(['/runs', 'b', 'replay']);
    });

    it('opens from the keyboard too', async () => {
      const { host } = await setUp([first]);

      expect(article(host, 0).getAttribute('tabindex')).toBe('0');
    });
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

  it('keeps its layout in developer mode, which has Model Tuning for the rest', async () => {
    const unchecked = { ...grouped, id: 'unchecked', checked: false };
    const { host } = await setUp([first, unchecked], false, false, undefined, true);

    expect(articles(host)).toHaveLength(1);
    expect(article(host, 0).getAttribute('role')).toBeNull();
    expect(host.querySelector('.handle, div.aggregate, app-grouping-settings-panel')).toBeNull();
  });

  describe('playing from a run', () => {
    /** The runs, and the line the game plays from among them, in the order shown. */
    function rows(host: HTMLElement): string[] {
      return Array.from(
        host.querySelectorAll('.runs > app-run-card, .runs > app-here-line'),
        (row) =>
          row.localName === 'app-here-line'
            ? 'here'
            : row.classList.contains('later')
              ? 'later'
              : 'run',
      );
    }

    it('plays from after a run long pressed, from its context menu, in developer mode', async () => {
      const { host, until } = await setUp(trusted, false, false, undefined, true);

      openMenu(host, 0);
      expect(menuItems(host)).toEqual(['Watch Replay', 'Delete Run', '—', 'Play from Here']);
      button(host, 'Play from Here').click();
      await until(() => host.querySelector('app-here-line') !== null);

      expect(rows(host)).toEqual(['run', 'here', 'later', 'later', 'later']);
      expect(host.querySelector('.summary h3')?.textContent.trim()).toBe('Runs before here');
    });

    it('plays from after all the runs again, from the line', async () => {
      const { host, until } = await setUp(trusted, false, false, undefined, true);
      await TestBed.inject(Tweaks).setRunOrder({ ids: trusted.map((run) => run.id), line: 1 });
      await until(() => host.querySelector('app-here-line') !== null);

      host.querySelector<HTMLButtonElement>('app-here-line .undo')?.click();
      await until(() => host.querySelector('app-here-line') === null);

      expect(rows(host)).toEqual(['run', 'run', 'run', 'run']);
      expect(host.querySelector('.summary h3')?.textContent.trim()).toBe('All runs');
    });

    it('offers it only in developer mode', async () => {
      const { host } = await setUp(trusted);

      openMenu(host, 0);

      expect(menuItems(host)).toEqual(['Watch Replay', 'Delete Run']);
    });
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
