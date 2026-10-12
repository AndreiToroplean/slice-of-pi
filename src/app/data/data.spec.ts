import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { IDBFactory } from 'fake-indexeddb';
import { Digit } from '../digit';
import { BACKUP_KIND, readBackup, writeBackup } from '../runs/backup';
import { addDigit, newRun, Run, RUN_FORMAT } from '../runs/run';
import { RUN_CLOCK } from '../runs/run-recorder';
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  INDEXED_DB,
  IS_PREVIEW,
  MAIN_FORMAT,
  META,
  RunStore,
  RUNS,
  STORAGE_MANAGER,
} from '../runs/run-store';
import { DEVELOPER_MODE, DEVELOPER_MODE_FORMAT, DeveloperMode } from '../developer/developer-mode';
import { Tweaks, TWEAKS, TWEAKS_FORMAT } from '../developer/tweaks';
import { PI_DECIMALS } from '../pi/pi-decimals';
import { DEFAULT_BREAK_SETTINGS } from '../timing/break-model';
import { installDialogs, uninstallDialogs } from '../../testing/fake-dialogs';
import { CONFIRM, Data, SAVE_FILE } from './data';

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

  async function setUp(
    runs: Run[] = [],
    persisted = false,
    preview = false,
    mainFormat?: number,
    developer = false,
  ): Promise<{
    host: HTMLElement;
    until: (ready: () => boolean) => Promise<void>;
  }> {
    const indexedDb = new IDBFactory();
    if (mainFormat !== undefined) {
      await noteMainFormat(indexedDb, mainFormat);
    }
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: INDEXED_DB, useValue: indexedDb },
        { provide: IS_PREVIEW, useValue: preview },
        {
          provide: STORAGE_MANAGER,
          useValue: { persisted: () => Promise.resolve(persisted) },
        },
        {
          provide: RUN_CLOCK,
          useValue: {
            now: () => 0,
            epoch: () => new Date(2026, 9, 10, 12).getTime(),
            newId: () => 'id',
          },
        },
        {
          provide: CONFIRM,
          useValue: (question: string) => {
            questions.push(question);
            return confirming;
          },
        },
        {
          provide: SAVE_FILE,
          useValue: (name: string, text: string) => saved.push({ name, text }),
        },
      ],
    });
    for (const run of runs) {
      await TestBed.inject(RunStore).save(run);
    }
    if (developer) {
      await TestBed.inject(DeveloperMode).set(true);
    }
    const fixture = TestBed.createComponent(Data);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    // Waits for the database to answer and the view to show it.
    const until = (ready: () => boolean): Promise<void> =>
      vi.waitFor(async () => {
        await fixture.whenStable();
        if (!ready()) {
          throw new Error('Not ready yet');
        }
      });
    // The page reads the runs as it opens.
    await until(() => host.querySelector('section p')?.textContent.trim() !== '');
    return { host, until };
  }

  /** Notes the main game's run format, as the main game does when it opens the database. */
  function noteMainFormat(indexedDb: IDBFactory, format: number): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(RUNS, { keyPath: 'id' });
        request.result.createObjectStore(META);
      };
      request.onsuccess = () => {
        const transaction = request.result.transaction(META, 'readwrite');
        transaction.objectStore(META).put({ format }, MAIN_FORMAT);
        transaction.oncomplete = () => {
          request.result.close();
          resolve();
        };
      };
    });
  }

  function text(host: HTMLElement): string {
    return host.textContent.replace(/\s+/g, ' ').trim();
  }

  function message(host: HTMLElement): string | undefined {
    return host.querySelector('[role="status"]')?.textContent.trim();
  }

  function button(host: HTMLElement, label: string): HTMLButtonElement {
    const found = Array.from(host.querySelectorAll('button')).find(
      (candidate) => candidate.textContent.trim() === label,
    );
    if (found === undefined) {
      throw new Error(`No button "${label}"`);
    }
    return found;
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
    await until(() => host.querySelector('app-grouping-settings-panel') !== null);

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
    expect(text(host)).toContain('No runs kept yet.');
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
      '1 group, none within the trust horizon; from the first dotted one on, the game plays groups of 5 that grow until you pause',
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

  it('sticks the chart of all runs to the bottom of the whole page, not only of the runs', async () => {
    const { host } = await setUp([first]);

    expect(host.querySelector(':scope > .summary')).not.toBeNull();
    expect(host.querySelector('.runs .summary')).toBeNull();
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
    expect(host.querySelector('.summary .meta')?.textContent).toBe(
      '10 groups, the first 9 within the trust horizon; from the first dotted one on, the game plays groups of 5 that grow until you pause',
    );
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

    it('hides unchecked runs outside developer mode, and leaves them out of the groups', async () => {
      const { host } = await setUp([grouped, unchecked]);

      expect(host.querySelectorAll('.runs article')).toHaveLength(1);
      expect(host.querySelector('.runs .badge')).toBeNull();
      expect(text(host)).toContain('1 run kept on this device.');
      expect(groupsShown(host)).toEqual([PI_DECIMALS.slice(0, 30)]);
      expect(host.querySelector('.unchecked')).toBeNull();
    });

    it('shows unchecked runs in developer mode, marked, still leaving them out of the groups', async () => {
      const { host } = await setUp([unchecked], false, false, undefined, true);

      const article = host.querySelector('.runs article');
      expect(article?.classList).toContain('unchecked');
      expect(article?.querySelector('h3 .badge')?.textContent.trim()).toBe('Unchecked');
      expect(text(host)).toContain('1 run kept on this device.');
      expect(groupsShown(host)).toEqual([]);
    });

    it('counts unchecked runs in the groups when told to, in developer mode', async () => {
      const { host, until } = await setUp([grouped, unchecked], false, false, undefined, true);
      const checkbox = host.querySelector<HTMLInputElement>('.unchecked input[type="checkbox"]');
      expect(host.querySelector('.unchecked p')?.textContent).toContain('1 run is unchecked');
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
    // A run grouped by 3, then the one played from and three after it.
    const runs: Run[] = [
      grouped,
      { ...grouped, id: 'from', startedAt: 3_001 },
      ...trusted.slice(0, 3),
    ];

    beforeEach(installDialogs);
    afterEach(uninstallDialogs);

    function groupsShown(host: HTMLElement): string[] {
      return Array.from(host.querySelectorAll('.groups li'), (group) => group.textContent.trim());
    }

    function dialog(host: HTMLElement): HTMLDialogElement | null {
      return host.querySelector('dialog[aria-labelledby="play-from-title"]');
    }

    function article(host: HTMLElement, index: number): HTMLElement {
      const found = host.querySelectorAll<HTMLElement>('.runs article')[index];
      if (found === undefined) {
        throw new Error(`No run ${String(index)}`);
      }
      return found;
    }

    async function playFrom(
      host: HTMLElement,
      until: (ready: () => boolean) => Promise<void>,
    ): Promise<void> {
      article(host, 1).dispatchEvent(new MouseEvent('contextmenu'));
      await until(() => dialog(host)?.open === true);
      button(host, 'Play from here').click();
      await until(() => host.querySelector('.here') !== null);
    }

    it('plays from a run long pressed, in developer mode, as if it and the later ones had never been played', async () => {
      const { host, until } = await setUp(runs, false, false, undefined, true);
      const before = groupsShown(host);

      await playFrom(host, until);

      expect(dialog(host)?.open).toBe(false);
      expect(TestBed.inject(Tweaks).values()).toEqual({ playFrom: 'from' });
      expect(article(host, 1).previousElementSibling?.textContent).toContain('You are here');
      expect(
        Array.from(host.querySelectorAll('.runs article'), (run) =>
          run.classList.contains('later'),
        ),
      ).toEqual([false, true, true, true, true]);
      expect(host.querySelector('.summary h3')?.textContent.trim()).toBe('Runs before here');
      expect(article(host, 1).querySelector('.meta')?.textContent).toContain('1 group');
      expect(before).toEqual(groupsBy3);
      expect(groupsShown(host)).toEqual([PI_DECIMALS.slice(0, 30)]);
    });

    it('counts every run again once undone', async () => {
      const { host, until } = await setUp(runs, false, false, undefined, true);
      const before = groupsShown(host);
      await playFrom(host, until);

      button(host, 'Undo').click();
      await until(() => host.querySelector('.here') === null);

      expect(TestBed.inject(Tweaks).values()).toEqual({});
      expect(host.querySelectorAll('.runs article.later')).toHaveLength(0);
      expect(host.querySelector('.summary h3')?.textContent.trim()).toBe('All runs');
      expect(groupsShown(host)).toEqual(before);
    });

    it('leaves the runs as they are when the player cancels', async () => {
      const { host, until } = await setUp(runs, false, false, undefined, true);

      article(host, 1).dispatchEvent(new MouseEvent('contextmenu'));
      await until(() => dialog(host)?.open === true);
      button(host, 'Cancel').click();
      await until(() => dialog(host)?.open === false);

      expect(TestBed.inject(Tweaks).values()).toEqual({});
      expect(host.querySelector('.here')).toBeNull();
    });

    it('offers it only in developer mode', async () => {
      const { host } = await setUp(runs);

      article(host, 1).dispatchEvent(new MouseEvent('contextmenu'));

      expect(dialog(host)?.open).toBe(false);
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

    expect(host.querySelector('.summary .meta')?.textContent).toContain('none within');
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

  it('charts the runs of a backup once restored', async () => {
    const { host, until } = await setUp();

    await choose(host, until, writeBackup([first], {}, 0));

    expect(host.querySelectorAll('app-run-chart')).toHaveLength(2);
  });

  it('goes back to the main menu', async () => {
    const { host } = await setUp();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    host.querySelector<HTMLButtonElement>('button.back')?.click();

    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });
});
