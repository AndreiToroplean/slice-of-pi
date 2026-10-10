import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
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
import { installDialogs } from '../../testing/dialogs';
import { RunsDialog, SAVE_FILE } from './runs-dialog';

describe('RunsDialog', () => {
  const first = addDigit(addDigit(newRun('a', 1_000), '1', 0), '4', 250);
  const second = addDigit(newRun('b', 2_000), '1', 0);
  let saved: { name: string; text: string }[];

  beforeEach(() => {
    installDialogs();
    saved = [];
  });

  async function setUp(
    runs: Run[] = [],
    persisted = false,
    preview = false,
    mainFormat?: number,
  ): Promise<{
    host: HTMLElement;
    dialog: RunsDialog;
    until: (ready: () => boolean) => Promise<void>;
  }> {
    const indexedDb = new IDBFactory();
    if (mainFormat !== undefined) {
      await noteMainFormat(indexedDb, mainFormat);
    }
    TestBed.configureTestingModule({
      providers: [
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
          provide: SAVE_FILE,
          useValue: (name: string, text: string) => saved.push({ name, text }),
        },
      ],
    });
    for (const run of runs) {
      await TestBed.inject(RunStore).save(run);
    }
    const fixture = TestBed.createComponent(RunsDialog);
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
    return { host, dialog: fixture.componentInstance, until };
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

  async function openDialog(
    host: HTMLElement,
    until: (ready: () => boolean) => Promise<void>,
  ): Promise<void> {
    host.querySelector<HTMLButtonElement>('button.open')?.click();
    await until(() => host.querySelector('dialog p')?.textContent.trim() !== '');
  }

  function text(host: HTMLElement): string {
    return host.querySelector('dialog')?.textContent.replace(/\s+/g, ' ').trim() ?? '';
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

  it('is closed at first, behind a labelled button', async () => {
    const { host } = await setUp();

    expect(host.querySelector('dialog')?.open).toBe(false);
    expect(host.querySelector('button.open')?.getAttribute('aria-label')).toBe(
      'Your runs and backups',
    );
  });

  it('opens on the button, and says there are no runs yet', async () => {
    const { host, dialog, until } = await setUp();

    await openDialog(host, until);

    expect(host.querySelector('dialog')?.open).toBe(true);
    expect(dialog.open()).toBe(true);
    expect(text(host)).toContain('No runs kept yet.');
  });

  it('counts the runs kept', async () => {
    const { host, until } = await setUp([first, second]);

    await openDialog(host, until);

    expect(text(host)).toContain('2 runs kept on this device.');
  });

  it('says when the browser may delete the runs', async () => {
    const { host, until } = await setUp([first]);

    await openDialog(host, until);

    expect(text(host)).toContain('1 run kept on this device.');
    expect(text(host)).toContain('may delete them when your device runs low on space');
  });

  it('says when the browser keeps the runs', async () => {
    const { host, until } = await setUp([first], true);

    await openDialog(host, until);

    expect(text(host)).toContain("keeps them until this site's data is cleared");
  });

  it('closes, and says so', async () => {
    const { host, dialog, until } = await setUp();
    await openDialog(host, until);

    host.querySelector('dialog')?.close();

    expect(dialog.open()).toBe(false);
  });

  it('saves a backup of every run, named after the date', async () => {
    const { host, until } = await setUp([first, second]);
    await openDialog(host, until);

    button(host, 'Save a backup').click();
    await until(() => message(host) !== '');

    expect(saved.map((file) => file.name)).toEqual(['slice-of-pi-2026-10-10.json']);
    expect(readBackup(saved[0]?.text ?? '')).toEqual({ runs: [first, second], skipped: 0 });
    expect(message(host)).toBe('Saved 2 runs in the backup.');
  });

  it('restores the runs of a backup that are not kept yet', async () => {
    const { host, until } = await setUp([first]);
    await openDialog(host, until);

    await choose(host, until, writeBackup([first, second], 0));

    expect(message(host)).toBe('Added 1 run from the backup.');
    expect(text(host)).toContain('2 runs kept on this device.');
    expect(await TestBed.inject(RunStore).runs()).toEqual([first, second]);
  });

  it('says when every run of a backup is already kept', async () => {
    const { host, until } = await setUp([first]);
    await openDialog(host, until);

    await choose(host, until, writeBackup([first], 0));

    expect(message(host)).toBe('Every run in this backup is already here.');
  });

  it('says how many runs of a backup could not be read', async () => {
    const { host, until } = await setUp();
    await openDialog(host, until);

    await choose(
      host,
      until,
      JSON.stringify({ kind: BACKUP_KIND, format: 1, runs: [first, 'run', {}] }),
    );

    expect(message(host)).toBe('Added 1 run from the backup. 2 runs in it could not be read.');
  });

  it('turns down a file that is not a backup', async () => {
    const { host, until } = await setUp();
    await openDialog(host, until);

    await choose(host, until, 'not a backup');

    expect(message(host)).toBe('This file is not a Slice of π backup.');
    expect(await TestBed.inject(RunStore).runs()).toEqual([]);
  });

  it('says when a preview keeps no runs, and offers no restore', async () => {
    const { host, until } = await setUp([], false, true, RUN_FORMAT + 1);

    await openDialog(host, until);

    expect(text(host)).toContain(
      "This preview of the game stores runs in a different format from the main game, so it doesn't keep any.",
    );
    expect(host.querySelector('input[type="file"]')).toBeNull();
    expect(button(host, 'Save a backup')).toBeTruthy();
  });

  it('says nothing about previews in the main game', async () => {
    const { host, until } = await setUp();

    await openDialog(host, until);

    expect(text(host)).not.toContain('preview');
    expect(host.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('clears the message when opened again', async () => {
    const { host, until } = await setUp();
    await openDialog(host, until);
    await choose(host, until, 'not a backup');
    host.querySelector('dialog')?.close();

    await openDialog(host, until);

    expect(message(host)).toBe('');
  });
});
