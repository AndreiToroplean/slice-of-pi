import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BACKUP_KIND, readBackup, writeBackup } from '../runs/backup';
import { addDigit, newRun, Run, RUN_FORMAT } from '../runs/run';
import { RunStore } from '../runs/run-store';
import { DEVELOPER_MODE, DEVELOPER_MODE_FORMAT } from '../developer/developer-mode';
import { Tweaks, TWEAKS, TWEAKS_FORMAT } from '../developer/tweaks';
import { DEFAULT_BREAK_SETTINGS } from '../timing/break-model';
import { button, message, OpenPage, openPage, text } from '../../testing/player-data-pages';
import { Data } from './data';

describe('Data', () => {
  const first = addDigit(addDigit(newRun('a', 1_000), '1', 0), '4', 250);
  const second = addDigit(newRun('b', 2_000), '1', 0);
  let saved: { name: string; text: string }[];

  beforeEach(() => {
    saved = [];
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

  it('says when a backup also keeps what was tuned in developer mode', async () => {
    const { host, until } = await setUp();
    expect(text(host)).not.toContain('developer mode');

    await TestBed.inject(Tweaks).setChecking(false);
    await until(() => text(host).includes('developer mode'));

    expect(text(host)).toContain('It also keeps what you tuned in developer mode.');
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

  it('goes back to the main menu', async () => {
    const { host } = await setUp();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    host.querySelector<HTMLButtonElement>('button.back')?.click();

    expect(navigate).toHaveBeenCalledWith('/', { replaceUrl: true });
  });
  describe('unchecked runs', () => {
    const unchecked = { ...second, checked: false };

    it('leaves the unchecked runs out of the count outside developer mode', async () => {
      const { host } = await setUp([first, unchecked]);

      expect(text(host)).toContain('1 run kept on this device.');
    });

    it('counts the unchecked runs kept in developer mode', async () => {
      const { host } = await setUp([first, unchecked], false, false, undefined, true);

      expect(text(host)).toContain('2 runs kept on this device.');
    });
  });
});
