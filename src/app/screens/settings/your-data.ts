import { Component, inject, InjectionToken, signal, viewChild } from '@angular/core';
import { DeveloperMode } from '../../developer-mode/developer-mode';
import { Tweaks } from '../../developer-mode/tweaks';
import { ButtonList } from '../../ui/button-list';
import { backupFileName, readBackup, writeBackup } from '../../player-data/backup';
import { DiscoverPaceSetting } from '../../player-data/discover-pace-setting';
import { GroupSizeSetting } from '../../player-data/group-size-setting';
import { KeypadLayoutSetting } from '../../player-data/keypad-layout-setting';
import { VibrationSetting } from '../../player-data/vibration-setting';
import { SoundSetting } from '../../player-data/sound-setting';
import { RUN_CLOCK, RunRecorder } from '../../player-data/run-recorder';
import { RunStore } from '../../player-data/run-store';
import { plural } from '../../ui/plural';
import { Candy } from '../../ui/candy';
import { ChoiceDialog } from '../../ui/choice-dialog';

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
 * restore, and a button deleting it all once the player has confirmed it.
 */
@Component({
  selector: 'app-your-data',
  imports: [ButtonList, Candy, ChoiceDialog],
  template: `
    <section class="panel" aria-labelledby="data-title">
      <h2 id="data-title">Your Data</h2>
      @if (store.separate()) {
        <p>
          This preview of the game keeps its data apart from the main game: it has a copy of the
          main game's, and what you do here stays here.
        </p>
      }
      <p>
        @if (store.persisted()) {
          Your runs and settings stay on this device until this site's data is cleared.
        } @else {
          Your runs and settings stay on this device, though your browser may delete them when it
          runs low on space.
        }
        A backup file keeps them safe even then.
      </p>
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
        <button
          type="button"
          appCandy="danger"
          aria-haspopup="dialog"
          (click)="deleteDialog.open()"
        >
          Delete All Your Data
        </button>
      </app-button-list>
      <p class="message" role="status">{{ message() }}</p>
    </section>
    <app-choice-dialog #deleteDialog heading="Start Over?">
      <p>
        This erases your runs and settings on this device for good. Only a backup file can bring
        them back.
      </p>
      <button type="button" appCandy (click)="void deleteDialog.close()">Back</button>
      <button type="button" appCandy="danger" (click)="void deleteAll()">
        Delete All Your Data
      </button>
    </app-choice-dialog>
  `,
  styleUrl: './your-data.css',
})
export class YourData {
  protected readonly message = signal('');
  private readonly deleteDialog = viewChild.required<ChoiceDialog>('deleteDialog');

  private readonly developer = inject(DeveloperMode);
  private readonly tweaks = inject(Tweaks);
  private readonly keypadLayout = inject(KeypadLayoutSetting);
  private readonly discoverPace = inject(DiscoverPaceSetting);
  private readonly groupSize = inject(GroupSizeSetting);
  private readonly vibration = inject(VibrationSetting);
  private readonly sound = inject(SoundSetting);
  protected readonly store = inject(RunStore);
  private readonly recorder = inject(RunRecorder);
  private readonly clock = inject(RUN_CLOCK);
  private readonly saveFile = inject(SAVE_FILE);

  protected async save(): Promise<void> {
    await this.recorder.saved();
    const settings = await this.store.settings();
    const runs = this.store.logs();
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

  /** Deletes every run and setting, once confirmed. */
  protected async deleteAll(): Promise<void> {
    void this.deleteDialog().close();
    await this.recorder.saved();
    await this.store.deleteEverything();
    await this.reload();
    this.message.set('Deleted all your data.');
  }

  /** Applies the data as it now stands. */
  private async reload(): Promise<void> {
    await Promise.all([
      this.developer.reload(),
      this.tweaks.reload(),
      this.keypadLayout.reload(),
      this.discoverPace.reload(),
      this.groupSize.reload(),
      this.vibration.reload(),
      this.sound.reload(),
    ]);
  }
}
