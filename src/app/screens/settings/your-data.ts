import { Component, ElementRef, inject, InjectionToken, signal, viewChild } from '@angular/core';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { ButtonList } from '../../ui/button-list';
import { backupFileName, readBackup, writeBackup } from '../../player-data/backup';
import { KeypadLayoutSetting } from '../../player-data/keypad-layout-setting';
import { RUN_CLOCK, RunRecorder } from '../../player-data/run-recorder';
import { RunStore } from '../../player-data/run-store';
import { plural } from '../../ui/plural';
import { Candy } from '../../ui/candy';
import { LightDismiss } from '../../ui/light-dismiss';

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
 * The player's data, a card at the top of the settings: how safe it is on this device, with a backup file to save and
 * restore, and a button to start over, erasing it all once the player has confirmed it.
 */
@Component({
  selector: 'app-your-data',
  imports: [ButtonList, Candy, LightDismiss],
  template: `
    <section class="panel" aria-labelledby="data-title">
      <div class="heading">
        <h2 id="data-title">Your Data</h2>
        <button
          type="button"
          appCandy="danger"
          class="small"
          aria-haspopup="dialog"
          (click)="resetDialog.showModal()"
        >
          Start Over
        </button>
      </div>
      @if (loaded()) {
        @if (separatePreview()) {
          <p>
            This preview of the game keeps its data apart from the main game: it has a copy of the
            main game's, and what you do here stays here.
          </p>
        }
        <p>
          @if (persisted()) {
            Your runs and settings stay on this device until this site's data is cleared.
          } @else {
            Your runs and settings stay on this device, though your browser may delete them when it
            runs low on space.
          }
          A backup file keeps them safe even then.
        </p>
      }
      <app-button-list class="buttons">
        <button type="button" appCandy (click)="save()">Save a Backup</button>
        <label appCandy>
          Restore from a Backup
          <input
            type="file"
            accept=".json,application/json"
            class="visually-hidden"
            (change)="restore($event)"
          />
        </label>
      </app-button-list>
      <p class="message" role="status">{{ message() }}</p>
    </section>
    <dialog
      #resetDialog
      class="card"
      closedby="any"
      aria-labelledby="reset-title"
      aria-describedby="reset-warning"
    >
      <h2 id="reset-title">Start Over?</h2>
      <p id="reset-warning">
        This erases your runs and settings on this device for good. Only a backup file can bring
        them back.
      </p>
      <app-button-list>
        <button type="button" appCandy autofocus (click)="resetDialog.close()">Back</button>
        <button type="button" appCandy="danger" (click)="void reset()">Erase Everything</button>
      </app-button-list>
    </dialog>
  `,
  styleUrl: './your-data.css',
})
export class YourData {
  /** Whether where the data stands has been read. */
  protected readonly loaded = signal(false);
  protected readonly persisted = signal(false);
  /** Whether this is a preview keeping its data apart from the main game's (see {@link RunStore}). */
  protected readonly separatePreview = signal(false);
  protected readonly message = signal('');
  private readonly resetDialog = viewChild.required<ElementRef<HTMLDialogElement>>('resetDialog');

  private readonly developer = inject(DeveloperMode);
  private readonly tweaks = inject(Tweaks);
  private readonly keypadLayout = inject(KeypadLayoutSetting);
  private readonly store = inject(RunStore);
  private readonly recorder = inject(RunRecorder);
  private readonly clock = inject(RUN_CLOCK);
  private readonly saveFile = inject(SAVE_FILE);

  constructor() {
    void this.refresh();
  }

  protected async save(): Promise<void> {
    await this.recorder.saved();
    const [runs, settings] = await Promise.all([this.store.touchLogs(), this.store.settings()]);
    const now = this.clock.epoch();
    this.saveFile(backupFileName(now), writeBackup(runs, settings, now));
    this.message.set('Saved a backup of your data.');
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
    await this.store.addRuns(contents.runs);
    await this.store.saveSettings(contents.settings);
    await this.reload();
    const unreadable =
      contents.skipped > 0 ? ` ${plural(contents.skipped, 'run')} in it could not be read.` : '';
    this.message.set(`Restored your data from the backup.${unreadable}`);
  }

  /** Erases every run and setting, once confirmed. */
  protected async reset(): Promise<void> {
    this.resetDialog().nativeElement.close();
    await this.recorder.saved();
    await this.store.deleteEverything();
    await this.reload();
    this.message.set('Erased your data: you start over.');
  }

  /** Applies the data as it now stands. */
  private async reload(): Promise<void> {
    await Promise.all([
      this.developer.reload(),
      this.tweaks.reload(),
      this.keypadLayout.reload(),
      this.refresh(),
    ]);
  }

  private async refresh(): Promise<void> {
    await this.recorder.saved();
    const [persisted, separate] = await Promise.all([
      this.store.persisted(),
      this.store.separate(),
    ]);
    this.separatePreview.set(separate);
    this.persisted.set(persisted);
    this.loaded.set(true);
  }
}
