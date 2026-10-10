import {
  Component,
  ElementRef,
  inject,
  InjectionToken,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { backupFileName, readBackup, writeBackup } from '../runs/backup';
import { RUN_CLOCK, RunRecorder } from '../runs/run-recorder';
import { IS_PREVIEW, RunStore } from '../runs/run-store';

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
 * The player's runs: how many are kept and how safe they are, with a backup file to save and restore. Opened from a
 * button in the corner of the play screen; `open` is true while the dialog is open.
 */
@Component({
  selector: 'app-runs-dialog',
  template: `
    <button type="button" class="open" aria-label="Your runs and backups" (click)="show()">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="5" rx="1.5" />
        <path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4" />
      </svg>
    </button>
    <dialog #dialog aria-labelledby="runs-title" (close)="open.set(false)">
      <h2 id="runs-title">Your runs</h2>
      <p>{{ count() }}</p>
      @if (readOnlyPreview()) {
        <p>
          This preview of the game stores runs in a different format from the main game, so it
          doesn't keep any.
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
      <div class="actions">
        <button type="button" (click)="save()">Save a backup</button>
        @if (!readOnlyPreview()) {
          <label class="button">
            Restore a backup
            <input
              type="file"
              accept=".json,application/json"
              class="visually-hidden"
              (change)="restore($event)"
            />
          </label>
        }
      </div>
      <p class="message" role="status">{{ message() }}</p>
      <form method="dialog">
        <button class="close">Close</button>
      </form>
    </dialog>
  `,
  styleUrl: './runs-dialog.css',
})
export class RunsDialog {
  readonly open = model(false);

  protected readonly count = signal('');
  protected readonly persisted = signal(false);
  /** Whether this is a preview that can't keep runs (see {@link RunStore}). */
  protected readonly readOnlyPreview = signal(false);
  protected readonly message = signal('');

  private readonly store = inject(RunStore);
  private readonly recorder = inject(RunRecorder);
  private readonly clock = inject(RUN_CLOCK);
  private readonly saveFile = inject(SAVE_FILE);
  private readonly preview = inject(IS_PREVIEW);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected async show(): Promise<void> {
    this.message.set('');
    this.open.set(true);
    this.dialog().nativeElement.showModal();
    await this.refresh();
  }

  protected async save(): Promise<void> {
    await this.recorder.saved();
    const runs = await this.store.runs();
    const now = this.clock.epoch();
    this.saveFile(backupFileName(now), writeBackup(runs, now));
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
    await this.refresh();
    const unreadable =
      contents.skipped > 0 ? ` ${plural(contents.skipped, 'run')} in it could not be read.` : '';
    this.message.set(
      (added > 0
        ? `Added ${plural(added, 'run')} from the backup.`
        : 'Every run in this backup is already here.') + unreadable,
    );
  }

  private async refresh(): Promise<void> {
    await this.recorder.saved();
    const [runs, persisted, writable] = await Promise.all([
      this.store.runs(),
      this.store.persisted(),
      this.store.writable(),
    ]);
    this.readOnlyPreview.set(this.preview && !writable);
    this.count.set(
      runs.length === 0
        ? 'No runs kept yet.'
        : `${plural(runs.length, 'run')} kept on this device.`,
    );
    this.persisted.set(persisted);
  }
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}
