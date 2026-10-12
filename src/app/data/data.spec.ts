import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Digit } from '../digit';
import { BACKUP_KIND, readBackup, writeBackup } from '../runs/backup';
import { addDigit, newRun, Run, RUN_FORMAT } from '../runs/run';
import { RunStore } from '../runs/run-store';
import { DEVELOPER_MODE, DEVELOPER_MODE_FORMAT } from '../developer/developer-mode';
import { Tweaks, TWEAKS, TWEAKS_FORMAT } from '../developer/tweaks';
import { PI_DECIMALS } from '../pi/pi-decimals';
import { DEFAULT_BREAK_SETTINGS } from '../timing/break-model';
import { installPopovers, uninstallPopovers } from '../../testing/fake-popovers';
import { button, message, OpenPage, openPage, text } from '../../testing/player-data-pages';
import { Data } from './data';

describe('Data', () => {
  const first = addDigit(addDigit(newRun('a', 1_000), '1', 0), '4', 250);
  const second = addDigit(newRun('b', 2_000), '1', 0);
  // Groups of 3: about 200 ms between digits, 700 ms before every fourth.
  const grouped = Array.from(PI_DECIMALS.slice(0, 30)).reduce(
    (run, digit, i) =>
      addDigit(
        run,
        digit as Digit,
        i === 0 ? 0 : (run.times.at(-1) ?? 0) + (i % 3 ? ([180, 230][i % 2] ?? 0) : 700),
      ),
    newRun('c', 3_000),
  );
  const groupsBy3 = PI_DECIMALS.slice(0, 30).match(/.../g) ?? [];
  /** Enough runs grouped by 3 for the game to trust their groups. */
  const trusted = ['d', 'e', 'f', 'g'].map((id, i) => ({ ...grouped, id, startedAt: 4_000 + i }));
  let saved: { name: string; text: string }[];
  /** The questions the player was asked to confirm, and their answer. */
  let questions: string[];
  let confirming: boolean;

  beforeEach(() => {
    saved = [];
    questions = [];
    confirming = true;
  });

  function setUp(
    runs: Run[] = [],
    persisted = false,
    preview = false,
    mainFormat?: number,
    developer = false,
  ): Promise<OpenPage> {
    // The page reads the runs as it opens.
    return openPage(Data, (host) => host.querySelector('section p')?.textContent.trim() !== '', {
      runs,
      persisted,
      preview,
      mainFormat,
      developer,
      confirm: (question) => {
        questions.push(question);
        return confirming;
      },
      saveFile: (name, text) => saved.push({ name, text }),
    });
  }

  async function choose(
    host: HTMLElement,
    until: (ready: () => boolean) => Promise<void>,
    content: string,
  ): Promise<void> {
    const input = host.querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) {
      throw new Error('No file input');
    }
    Object.defineProperty(input, 'files', {
      value: [new File([content], 'backup.json')],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await until(() => message(host) !== '');
  }

  it('says there are no runs yet', async () => {
    const { host } = await setUp();

    expect(text(host)).toContain('No runs kept yet.');
  });

  it('counts the runs kept', async () => {
    const { host } = await setUp([first, second]);

    expect(text(host)).toContain('2 runs kept on this device.');
  });

  it('says when the browser may delete the runs', async () => {
    const { host } = await setUp([first]);

    expect(text(host)).toContain('1 run kept on this device.');
    expect(text(host)).toContain('may delete them when your device runs low on space');
  });

  it('says when the browser keeps the runs', async () => {
    const { host } = await setUp([first], true);

    expect(text(host)).toContain("keeps them until this site's data is cleared");
  });

  it('saves a backup of every run and setting, named after the date', async () => {
    const { host, until } = await setUp([first, second], false, false, undefined, true);

    button(host, 'Save a backup').click();
    await until(() => message(host) !== '');

    expect(saved.map((file) => file.name)).toEqual(['slice-of-pi-2026-10-10.json']);
    expect(readBackup(saved[0]?.text ?? '')).toEqual({
      runs: [first, second],
      skipped: 0,
      settings: { [DEVELOPER_MODE]: { format: DEVELOPER_MODE_FORMAT, enabled: true } },
    });
    expect(message(host)).toBe('Saved 2 runs in the backup.');
  });

  it('restores the runs of a backup that are not kept yet', async () => {
    const { host, until } = await setUp([first]);

    await choose(host, until, writeBackup([first, second], {}, 0));

    expect(message(host)).toBe('Added 1 run from the backup.');
    expect(text(host)).toContain('2 runs kept on this device.');
    expect(await TestBed.inject(RunStore).runs()).toEqual([first, second]);
  });

  it('restores the settings of a backup, and applies them', async () => {
    const { host, until } = await setUp([first]);
    const grouping = { ...DEFAULT_BREAK_SETTINGS, level: 0.8 };

    await choose(
      host,
      until,
      writeBackup(
        [first],
        {
          [DEVELOPER_MODE]: { format: DEVELOPER_MODE_FORMAT, enabled: true },
          [TWEAKS]: { format: TWEAKS_FORMAT, grouping },
        },
        0,
      ),
    );

    expect(message(host)).toBe(
      'Every run in this backup is already here. Its settings replace yours.',
    );
    expect(TestBed.inject(Tweaks).grouping()).toEqual(grouping);
  });

  it('says when every run of a backup is already kept', async () => {
    const { host, until } = await setUp([first]);

    await choose(host, until, writeBackup([first], {}, 0));

    expect(message(host)).toBe('Every run in this backup is already here.');
  });

  it('says how many runs of a backup could not be read', async () => {
    const { host, until } = await setUp();

    await choose(
      host,
      until,
      JSON.stringify({ kind: BACKUP_KIND, format: 1, runs: [first, 'run', {}] }),
    );

    expect(message(host)).toBe('Added 1 run from the backup. 2 runs in it could not be read.');
  });

  it('turns down a file that is not a backup', async () => {
    const { host, until } = await setUp();

    await choose(host, until, 'not a backup');

    expect(message(host)).toBe('This file is not a Slice of π backup.');
    expect(await TestBed.inject(RunStore).runs()).toEqual([]);
  });

  it('deletes every run once the player confirms', async () => {
    const { host, until } = await setUp([first, second]);

    button(host, 'Delete all runs').click();
    await until(() => message(host) !== '');

    expect(questions).toEqual([
      'Delete all 2 runs kept on this device? Only a backup file can bring them back.',
    ]);
    expect(message(host)).toBe('Deleted 2 runs.');
    expect(await TestBed.inject(RunStore).runs()).toEqual([]);
    expect(button(host, 'Delete all runs').disabled).toBe(true);
  });

  it('keeps the runs when the player does not confirm', async () => {
    const { host } = await setUp([first]);
    confirming = false;

    button(host, 'Delete all runs').click();
    await vi.waitFor(() => {
      expect(questions).toEqual([
        'Delete the run kept on this device? Only a backup file can bring it back.',
      ]);
    });

    expect(await TestBed.inject(RunStore).runs()).toEqual([first]);
  });

  it('says when a preview keeps its runs apart from the main game', async () => {
    const { host } = await setUp([], false, true, RUN_FORMAT + 1);

    expect(text(host)).toContain(
      "This preview of the game stores runs in a different format from the main game, so it keeps them apart: it has a copy of the main game's runs, and the runs played here stay here.",
    );
    expect(host.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('says nothing about previews in the main game', async () => {
    const { host } = await setUp();

    expect(text(host)).not.toContain('preview');
    expect(host.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('says when there are no runs to chart', async () => {
    const { host } = await setUp();

    expect(host.querySelector('.runs')?.textContent).toContain(
      'None yet: each game you play shows up here.',
    );
    expect(host.querySelector('app-run-chart')).toBeNull();
  });

  it('charts each run, oldest first, then all of them', async () => {
    const { host } = await setUp([second, first]);

    const titles = Array.from(host.querySelectorAll('h3'), (title) => title.textContent.trim());
    const format = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    expect(titles).toEqual([format.format(1_000), format.format(2_000), 'All runs']);
    expect(Array.from(host.querySelectorAll('.meta'), (meta) => meta.textContent)).toEqual([
      '2 digits in 0.3 s · 1 group',
      '1 digit in 0.0 s · 1 group',
    ]);
    const labels = Array.from(host.querySelectorAll('app-run-chart svg'), (svg) =>
      svg.getAttribute('aria-label'),
    );
    expect(labels).toEqual([
      `Time per digit, ${format.format(1_000)}`,
      `Time per digit, ${format.format(2_000)}`,
      'Time per digit over all runs, recent ones weighing more, with your usual break spots',
    ]);
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
    expect(host.querySelectorAll('.summary .break')).toHaveLength(9);
    expect(host.querySelector('.summary .confidence')).not.toBeNull();
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

    it('leaves the unchecked runs out of the count outside developer mode', async () => {
      const { host } = await setUp([grouped, unchecked]);

      expect(text(host)).toContain('1 run kept on this device.');
    });

    it('counts the unchecked runs kept in developer mode', async () => {
      const { host } = await setUp([grouped, unchecked], false, false, undefined, true);

      expect(text(host)).toContain('2 runs kept on this device.');
    });

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
      expect(host.querySelector('app-grouping-settings-panel .unchecked p')).toBeNull();
      expect(checkbox?.checked).toBe(false);

      expect(groupsShown(host)).toEqual([PI_DECIMALS.slice(0, 30)]);

      checkbox?.click();
      await until(() => groupsShown(host).length > 1);

      expect(groupsShown(host)).toEqual(groupsBy3);
      expect(TestBed.inject(Tweaks).values()).toEqual({ includeUnchecked: true });
    });

    it('deletes the unchecked runs once the player confirms, in developer mode', async () => {
      const { host, until } = await setUp([grouped, unchecked], false, false, undefined, true);

      button(host, 'Delete unchecked runs').click();
      await until(() => message(host) !== '');

      expect(questions).toEqual([
        'Delete the unchecked run? Only a backup file can bring it back.',
      ]);
      expect(message(host)).toBe('Deleted 1 unchecked run.');
      expect(await TestBed.inject(RunStore).runs()).toEqual([grouped]);
      expect(button(host, 'Delete unchecked runs').disabled).toBe(true);
    });
  });

  describe('playing from a run', () => {
    // A run grouped by 3, one to play from, then three grouped by 3 played after it.
    const from = { ...grouped, id: 'from', startedAt: 3_001 };
    const runs: Run[] = [grouped, from, ...trusted.slice(0, 3)];
    /** When the game started playing from before the run to play from, in the tests where it did. */
    const since = 3_500;

    beforeEach(installPopovers);
    afterEach(uninstallPopovers);

    function groupsShown(host: HTMLElement): string[] {
      return Array.from(host.querySelectorAll('.groups li'), (group) => group.textContent.trim());
    }

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

    function later(host: HTMLElement): boolean[] {
      return articles(host).map((run) => run.classList.contains('later'));
    }

    function menu(host: HTMLElement): HTMLElement | null {
      return host.querySelector('.run-menu');
    }

    /** Where the "You are here" line is among the runs: how many come before it. */
    function here(host: HTMLElement): number | undefined {
      const children = Array.from(host.querySelectorAll('.runs > article, .runs > .here'));
      const line = children.findIndex((child) => child.classList.contains('here'));
      return line === -1 ? undefined : line;
    }

    it('plays from before a run long pressed, from its context menu, in developer mode', async () => {
      const { host, until } = await setUp(runs, false, false, undefined, true);
      const before = groupsShown(host);

      article(host, 1).dispatchEvent(new MouseEvent('contextmenu', { clientX: 40, clientY: 50 }));
      await until(() => menu(host)?.hasAttribute('data-popover-open') === true);
      button(host, 'Play from here').click();
      await until(() => here(host) !== undefined);

      expect(menu(host)?.hasAttribute('data-popover-open')).toBe(false);
      expect(TestBed.inject(Tweaks).values()).toEqual({
        playFrom: { at: 1, since: new Date(2026, 9, 10, 12).getTime() },
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

      await TestBed.inject(Tweaks).setPlayFrom({ at: 1, since });
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
      await TestBed.inject(Tweaks).setPlayFrom({ at: 1, since });
      await until(() => here(host) === 4);
      const shown = articles(host).map((run) => run.querySelector('h3')?.textContent);

      article(host, 3).dispatchEvent(new MouseEvent('contextmenu', { clientX: 40, clientY: 50 }));
      await until(() => menu(host)?.hasAttribute('data-popover-open') === true);
      button(host, 'Play from here').click();
      await until(() => here(host) === 3);

      expect(articles(host).map((run) => run.querySelector('h3')?.textContent)).toEqual(shown);
      expect(later(host)).toEqual([false, false, false, true, true]);
    });

    it('puts the runs back in the order they were played once undone', async () => {
      const { host, until } = await setUp(runs, false, false, undefined, true);
      const before = articles(host).map((run) => run.querySelector('h3')?.textContent);
      await TestBed.inject(Tweaks).setPlayFrom({ at: 1, since });
      await until(() => here(host) !== undefined);

      host.querySelector<HTMLButtonElement>('.here .undo')?.click();
      await until(() => here(host) === undefined);

      expect(TestBed.inject(Tweaks).values()).toEqual({});
      expect(articles(host).map((run) => run.querySelector('h3')?.textContent)).toEqual(before);
      expect(later(host)).toEqual([false, false, false, false, false]);
      expect(host.querySelector('.summary h3')?.textContent.trim()).toBe('All runs');
    });

    it('draws the line after all the runs when they all come before it', async () => {
      const { host, until } = await setUp(runs, false, false, undefined, true);

      await TestBed.inject(Tweaks).setPlayFrom({ at: 9, since: 9_000 });
      await until(() => here(host) !== undefined);

      expect(here(host)).toBe(5);
    });

    it('offers it only in developer mode', async () => {
      const { host } = await setUp(runs);

      article(host, 1).dispatchEvent(new MouseEvent('contextmenu'));

      expect(menu(host)?.hasAttribute('data-popover-open')).toBe(false);
      expect(article(host, 1).hasAttribute('tabindex')).toBe(false);
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

  it('goes back to the main menu', async () => {
    const { host } = await setUp();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    host.querySelector<HTMLButtonElement>('button.back')?.click();

    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });
});
