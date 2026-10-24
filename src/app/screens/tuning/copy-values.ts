import { Component, inject, InjectionToken, input, signal } from '@angular/core';
import { TweakValues, tweaksBackup } from '../../developer-mode/tweaks';
import { RUN_CLOCK } from '../../player-data/run-recorder';

/** Puts text on the clipboard. */
export const WRITE_CLIPBOARD = new InjectionToken<(text: string) => Promise<void>>(
  'WRITE_CLIPBOARD',
  { factory: () => (text) => navigator.clipboard.writeText(text) },
);

/** How long "Copied" shows on the button. */
export const COPIED_MS = 2000;
const LABEL = 'Copy Hyperparameter Values';

/**
 * The button of a developer mode page that copies the values tuned on it, as a backup holding them alone (see
 * {@link tweaksBackup}), to hand back so they go into the code.
 */
@Component({
  selector: 'app-copy-values',
  template: `<button type="button" class="candy" (click)="void copy()">{{ label() }}</button>`,
  styleUrl: './copy-values.css',
})
export class CopyValues {
  /** The values to copy. */
  readonly values = input.required<TweakValues>();

  protected readonly label = signal(LABEL);
  private readonly writeClipboard = inject(WRITE_CLIPBOARD);
  private readonly clock = inject(RUN_CLOCK);
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected async copy(): Promise<void> {
    try {
      await this.writeClipboard(tweaksBackup(this.values(), this.clock.epoch()));
      this.label.set('Copied');
    } catch {
      this.label.set("Couldn't Copy");
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.label.set(LABEL);
    }, COPIED_MS);
  }
}
