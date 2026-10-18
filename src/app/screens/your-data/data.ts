import { Component, computed, inject, InjectionToken, signal } from '@angular/core';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { Page } from '../../ui/page';
import { backupFileName, readBackup, writeBackup } from '../../player-data/backup';
import { KeypadLayoutSetting } from '../../player-data/keypad-layout-setting';
import { Run } from '../../player-data/run';
import { RUN_CLOCK, RunRecorder } from '../../player-data/run-recorder';
import { RunStore } from '../../player-data/run-store';
import { plural } from '../../ui/plural';

/** Hands a file to the player, as a download. */
export const SAVE_FILE = new InjectionToken<(name: string, text: string) => void>('SAVE_FILE', {
  factory: () => (name, text) => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    // Revoked later, once the browser has started the download.
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60_000);
  },
});

/**
 * The player's data, opened from the main menu's overflow menu: how many runs are kept and how safe they are, with a
 * backup file to save and restore, which also keeps what was tuned in developer mode.
 */
@Component({
  selector: 'app-data',
  imports: [Page],
  template: `
    <app-page title="Your Data">
      <section class="panel" aria-labelledby="backup-title">
        <h2 id="backup-title">Backup</h2>
        <p>{{ count() }}</p>
        @if (separatePreview()) {
          <p>
            This preview of the game stores runs in a different format from the main game, so it
            keeps them apart: it has a copy of the main game's runs, and the runs played here stay
            here.
          </p>
        }
        <p>
          @if (persisted()) {
            Your browser keeps them until this site's data is cleared.
          } @else {
            Your browser may delete them when your device runs low on space.
          }
          A backup file keeps them safe even then.
        </p>
        @if (tuned()) {
          <p>It also keeps what you tuned in developer mode.</p>
        }
        <div class="buttons">
          <button type="button" class="candy" (click)="save()">Save a Backup</button>
          <label class="candy">
            Restore a Backup
            <input
              type="file"
              accept=".json,application/json"
              class="visually-hidden"
              (change)="restore($event)"
            />
          </label>
        </div>
        <p class="message" role="status">{{ message() }}</p>
      </section>
    </app-page>
  `,
  styleUrl: './data.css',
})
export class Data {
  /** Whether the runs have been read. */
  private readonly loaded = signal(false);
  protected readonly persisted = signal(false);
  /** Whether this is a preview keeping its runs apart from the main game's (see {@link RunStore}). */
  protected readonly separatePreview = signal(false);
  protected readonly message = signal('');

  private readonly developer = inject(DeveloperMode);
  private readonly tweaks = inject(Tweaks);
  private readonly keypadLayout = inject(KeypadLayoutSetting);
  private readonly runs = signal<readonly Run[]>([]);
  /** Unchecked runs, which may hold mistakes, only count in developer mode. */
  private readonly shown = computed(() =>
    this.runs().filter((run) => run.checked || this.developer.enabled()),
  );
  protected readonly count = computed(() => {
    if (!this.loaded()) {
      return '';
    }
    const count = this.shown().length;
    return count === 0 ? 'No runs kept yet.' : `${plural(count, 'run')} kept on this device.`;
  });

  /** What was tuned in developer mode, whether or not it's on, which a backup keeps too. */
  protected readonly tuned = computed(() => Object.keys(this.tweaks.values()).length > 0);

  private readonly store = inject(RunStore);
  private readonly recorder = inject(RunRecorder);
  private readonly clock = inject(RUN_CLOCK);
  private readonly saveFile = inject(SAVE_FILE);

  constructor() {
    void this.refresh();
  }

  protected async save(): Promise<void> {
    await this.recorder.saved();
    const [runs, settings] = await Promise.all([this.store.runs(), this.store.settings()]);
    const now = this.clock.epoch();
    this.saveFile(backupFileName(now), writeBackup(runs, settings, now));
    this.message.set(`Saved ${plural(runs.length, 'run')} in the backup.`);
  }

  protected async restore(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file === undefined) {
      return;
    }
    const contents = readBackup(await file.text());
    if ('error' in contents) {
      this.message.set(contents.error);
      return;
    }
    const added = await this.store.addRuns(contents.runs);
    await this.store.saveSettings(contents.settings);
    await Promise.all([
      this.developer.reload(),
      this.tweaks.reload(),
      this.keypadLayout.reload(),
      this.refresh(),
    ]);
    const unreadable =
      contents.skipped > 0 ? ` ${plural(contents.skipped, 'run')} in it could not be read.` : '';
    const settings =
      Object.keys(contents.settings).length > 0 ? ' Its settings replace yours.' : '';
    this.message.set(
      (added > 0
        ? `Added ${plural(added, 'run')} from the backup.`
        : 'Every run in this backup is already here.') +
        unreadable +
        settings,
    );
  }

  private async refresh(): Promise<void> {
    await this.recorder.saved();
    const [runs, persisted, separate] = await Promise.all([
      this.store.runs(),
      this.store.persisted(),
      this.store.separate(),
    ]);
    this.runs.set(runs);
    this.loaded.set(true);
    this.separatePreview.set(separate);
    this.persisted.set(persisted);
  }
}
