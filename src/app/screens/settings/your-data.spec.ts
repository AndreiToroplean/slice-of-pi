import { TestBed } from '@angular/core/testing';
import { BACKUP_KIND, readBackup, writeBackup } from '../../player-data/backup';
import { newTouchLog, TouchLog, TOUCH_LOG_FORMAT } from '../../player-data/touch-log';
import { typeKey } from '../../../testing/touch-logs';
import { RunStore } from '../../player-data/run-store';
import { installDialogs, uninstallDialogs } from '../../../testing/fake-dialogs';
import {
  DEVELOPER_MODE,
  DEVELOPER_MODE_FORMAT,
  DeveloperMode,
} from '../../developer-mode/developer-mode';
import {
  KEYPAD_LAYOUT,
  KEYPAD_LAYOUT_FORMAT,
  KeypadLayoutSetting,
} from '../../player-data/keypad-layout-setting';
import { Tweaks, TWEAKS, TWEAKS_FORMAT } from '../../developer-mode/tweaks';
import { MERCURY_DEFAULTS } from '../../game/grouping/break-models/mercury';
import { button, message, OpenPage, openPage, text } from '../../../testing/player-data-pages';
import { YourData } from './your-data';

describe('YourData', () => {
  const first = typeKey(typeKey(newTouchLog('a', 1_000), '1', 0), '4', 250);
  const second = typeKey(newTouchLog('b', 2_000), '1', 0);
  let saved: { name: string; text: string }[];

  beforeEach(() => {
    saved = [];
  });

  function setUp(
    runs: TouchLog[] = [],
    persisted = false,
    preview = false,
    mainFormat?: number,
    developer = false,
  ): Promise<OpenPage> {
    // The page reads the runs as it opens.
    return openPage(
      YourData,
      (host) => host.querySelector('section p')?.textContent.trim() !== '',
      {
        runs,
        persisted,
        preview,
        mainFormat,
        developer,
        saveFile: (name, text) => saved.push({ name, text }),
      },
    );
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

  it('says when the browser may delete the data, and that a backup keeps it safe', async () => {
    const { host } = await setUp([first]);

    expect(text(host)).toContain(
      'Your runs and settings stay on this device, though your browser may delete them when it runs low on space. A backup file keeps them safe even then.',
    );
  });

  it('says when the browser keeps the data', async () => {
    const { host } = await setUp([first], true);

    expect(text(host)).toContain(
      "Your runs and settings stay on this device until this site's data is cleared.",
    );
  });

  it('saves a backup of every run and setting, named after the time', async () => {
    const { host, until } = await setUp([first, second], false, false, undefined, true);

    button(host, 'Save a Backup').click();
    await until(() => message(host) !== '');

    expect(saved.map((file) => file.name)).toEqual(['slice-of-pi-2026-10-10-12-00-00-000.json']);
    expect(readBackup(saved[0]?.text ?? '')).toEqual({
      runs: [first, second],
      skipped: 0,
      settings: { [DEVELOPER_MODE]: { format: DEVELOPER_MODE_FORMAT, enabled: true } },
    });
    expect(message(host)).toBe('Saved a backup of your data.');
  });

  it('restores the runs of a backup that are not kept yet', async () => {
    const { host, until } = await setUp([first]);

    await choose(host, until, writeBackup([first, second], {}, 0));

    expect(message(host)).toBe('Restored your data from the backup.');
    expect(await TestBed.inject(RunStore).touchLogs()).toEqual([first, second]);
  });

  it('restores the settings of a backup, and applies them', async () => {
    const { host, until } = await setUp([first]);
    const grouping = { ...MERCURY_DEFAULTS, level: 0.8 };

    await choose(
      host,
      until,
      writeBackup(
        [first],
        {
          [DEVELOPER_MODE]: { format: DEVELOPER_MODE_FORMAT, enabled: true },
          [TWEAKS]: { format: TWEAKS_FORMAT, grouping: { mercury: grouping } },
          [KEYPAD_LAYOUT]: { format: KEYPAD_LAYOUT_FORMAT, layout: 'telephone' },
        },
        0,
      ),
    );

    expect(message(host)).toBe('Restored your data from the backup.');
    expect(TestBed.inject(Tweaks).grouping()).toEqual(grouping);
    expect(TestBed.inject(KeypadLayoutSetting).layout()).toBe('telephone');
  });

  it('says how many runs of a backup could not be read', async () => {
    const { host, until } = await setUp();

    await choose(
      host,
      until,
      JSON.stringify({ kind: BACKUP_KIND, format: 1, runs: [first, 'run', {}] }),
    );

    expect(message(host)).toBe(
      'Restored your data from the backup. 2 runs in it could not be read.',
    );
  });

  it('turns down a file that is not a backup', async () => {
    const { host, until } = await setUp();

    await choose(host, until, 'not a backup');

    expect(message(host)).toBe('This file is not a Slice of π backup.');
    expect(await TestBed.inject(RunStore).touchLogs()).toEqual([]);
  });

  describe('deleting all the data', () => {
    beforeEach(() => {
      installDialogs();
    });

    afterEach(() => {
      uninstallDialogs();
    });

    it('asks first, warning that the data is erased for good, and erases nothing on Back', async () => {
      const { host } = await setUp([first], false, false, undefined, true);
      const dialog = host.querySelector('dialog');
      const warning = dialog?.getAttribute('aria-describedby') ?? '';

      button(host, 'Delete All Your Data').click();

      expect(dialog?.open).toBe(true);
      expect(host.querySelector('#delete-title')?.textContent).toBe('Start Over?');
      expect(host.querySelector(`#${warning}`)?.textContent).toContain('for good');
      button(host, 'Back').click();
      expect(dialog?.open).toBe(false);
      expect(await TestBed.inject(RunStore).touchLogs()).toEqual([first]);
      expect(TestBed.inject(DeveloperMode).enabled()).toBe(true);
    });

    it('deletes every run and setting once confirmed, and applies that', async () => {
      const { host, until } = await setUp([first, second], false, false, undefined, true);
      await TestBed.inject(KeypadLayoutSetting).set('telephone');

      button(host, 'Delete All Your Data').click();
      const dialog = host.querySelector('dialog');
      button(dialog ?? host, 'Delete All Your Data').click();
      await until(() => message(host) !== '');

      expect(dialog?.open).toBe(false);
      expect(message(host)).toBe('Deleted all your data.');
      expect(await TestBed.inject(RunStore).touchLogs()).toEqual([]);
      expect(await TestBed.inject(RunStore).settings()).toEqual({});
      expect(TestBed.inject(DeveloperMode).enabled()).toBe(false);
      expect(TestBed.inject(KeypadLayoutSetting).layout()).toBe('calculator');
    });
  });

  it('says when a preview keeps its data apart from the main game', async () => {
    const { host } = await setUp([], false, true, TOUCH_LOG_FORMAT + 1);

    expect(text(host)).toContain(
      "This preview of the game keeps its data apart from the main game: it has a copy of the main game's, and what you do here stays here.",
    );
    expect(host.querySelector('input[type="file"]')).not.toBeNull();
  });

  it('says nothing about previews in the main game', async () => {
    const { host } = await setUp();

    expect(text(host)).not.toContain('preview');
    expect(host.querySelector('input[type="file"]')).not.toBeNull();
  });
});
