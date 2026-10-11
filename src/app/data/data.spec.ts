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
import { DEFAULT_TIMING_SETTINGS } from '../timing/timing-model';
import { CONFIRM, Data, SAVE_FILE } from './data';

describe('Data', () => {
  const first = addDigit(addDigit(newRun('a', 1_000), '1', 0), '4', 250);
  const second = addDigit(newRun('b', 2_000), '1', 0);
  // Groups of 3: 200 ms between digits, 700 ms before every fourth.
  const grouped = Array.from('141592653589').reduce(
    (run, digit, i) =>
      addDigit(run, digit as Digit, i === 0 ? 0 : (run.times.at(-1) ?? 0) + (i % 3 ? 200 : 700)),
    newRun('c', 3_000),
  );
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
    const grouping = { ...DEFAULT_TIMING_SETTINGS, halfLife: 4 };

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

  it('says when a preview keeps no runs, and offers no restore', async () => {
    const { host } = await setUp([], false, true, RUN_FORMAT + 1);

    expect(text(host)).toContain(
      "This preview of the game stores runs in a different format from the main game, so it doesn't keep any.",
    );
    expect(host.querySelector('input[type="file"]')).toBeNull();
    expect(() => button(host, 'Delete all runs')).toThrow();
    expect(button(host, 'Save a backup')).toBeTruthy();
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

    const titles = Array.from(host.querySelectorAll('.runs h3'), (title) => title.textContent);
    const format = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    expect(titles).toEqual([format.format(1_000), format.format(2_000), 'All runs']);
    expect(Array.from(host.querySelectorAll('.runs .meta'), (meta) => meta.textContent)).toEqual([
      '2 digits in 0.3 s · 1 group',
      '1 digit in 0.0 s · 1 group',
      '1 group, 0 sure enough to set the hint; dotted ones get the default of 5',
    ]);
    const labels = Array.from(host.querySelectorAll('app-run-chart svg'), (svg) =>
      svg.getAttribute('aria-label'),
    );
    expect(labels).toEqual([
      `Time per digit, ${format.format(1_000)}`,
      `Time per digit, ${format.format(2_000)}`,
      'Time per digit over all runs, recent ones weighing more, with the breaks they agree on',
    ]);
  });

  it('marks the breaks of each run on its chart, and counts its groups', async () => {
    const { host } = await setUp([grouped]);

    const chart = host.querySelector('.runs article app-run-chart');
    expect(
      Array.from(chart?.querySelectorAll('.break') ?? [], (bar) => bar.getAttribute('x1')),
    ).toEqual(['2.5', '5.5', '8.5']);
    expect(chart?.querySelector('.pace')).not.toBeNull();
    expect(host.querySelector('.runs .meta')?.textContent).toBe('12 digits in 3.7 s · 4 groups');
  });

  it('shows the groups of all runs, dotted where the hint keeps its default', async () => {
    const { host } = await setUp([grouped]);

    expect(
      Array.from(host.querySelectorAll('.groups li'), (group) => [
        group.textContent.trim(),
        group.classList.contains('unsure'),
      ]),
    ).toEqual([
      ['141', false],
      ['592', false],
      ['653', false],
      ['589', true],
    ]);
    expect(host.querySelector('.summary .meta')?.textContent).toBe(
      '4 groups, 3 sure enough to set the hint; dotted ones get the default of 5',
    );
    expect(host.querySelectorAll('.summary .break')).toHaveLength(3);
  });

  describe('unchecked runs', () => {
    const unchecked = { ...grouped, id: 'unchecked', checked: false };

    function groupsShown(host: HTMLElement): string[] {
      return Array.from(host.querySelectorAll('.groups li'), (group) => group.textContent.trim());
    }

    it('marks unchecked runs, and leaves them out of the groups', async () => {
      const { host } = await setUp([unchecked]);

      expect(host.querySelector('.runs .meta')?.textContent).toBe(
        '12 digits in 3.7 s · 4 groups · unchecked',
      );
      expect(groupsShown(host)).toEqual([]);
      expect(host.querySelector('.unchecked')).toBeNull();
    });

    it('counts unchecked runs in the groups when told to, in developer mode', async () => {
      const { host, until } = await setUp([unchecked], false, false, undefined, true);
      const checkbox = host.querySelector<HTMLInputElement>('.unchecked input[type="checkbox"]');
      expect(host.querySelector('.unchecked p')?.textContent).toContain('1 run is unchecked');
      expect(checkbox?.checked).toBe(false);

      checkbox?.click();
      await until(() => groupsShown(host).length > 0);

      expect(groupsShown(host)).toEqual(['141', '592', '653', '589']);
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

  it('offers the grouping settings only in developer mode', async () => {
    const { host } = await setUp([grouped]);

    expect(host.querySelector('app-grouping-settings-panel')).toBeNull();
  });

  it('regroups as the grouping settings change', async () => {
    const { host, until } = await setUp([grouped], false, false, undefined, true);
    const slider = host.querySelector<HTMLInputElement>('#setting-minimumPause');

    if (slider === null) {
      throw new Error('No slider');
    }
    slider.value = '3';
    slider.dispatchEvent(new Event('input'));
    await until(() => host.querySelectorAll('.groups li').length === 1);

    expect(host.querySelector('.groups li')?.textContent.trim()).toBe('141592653589');
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
