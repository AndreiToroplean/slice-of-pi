import { Component, computed, inject, InjectionToken, input, signal } from '@angular/core';
import { TweakValues, tweaksBackup } from '../../developer-mode/tweaks';
import { RUN_CLOCK } from '../../player-data/run-recorder';
import { Candy } from '../../ui/candy';

/** Puts text on the clipboard. */
export const WRITE_CLIPBOARD = new InjectionToken<(text: string) => Promise<void>>(
  'WRITE_CLIPBOARD',
  { factory: () => (text) => navigator.clipboard.writeText(text) },
);

/** How long "Copied" shows on the button. */
export const COPIED_MS = 2000;

/**
 * The button of a developer mode page that copies the values tuned on it, as a backup holding them alone (see
 * {@link tweaksBackup}), to hand back so they go into the code.
 */
@Component({
  selector: 'app-copy-values',
  imports: [Candy],
  template: `<button type="button" appCandy (click)="void copy()">{{ shown() }}</button>`,
  styleUrl: './copy-values.css',
})
export class CopyValues {
  /** The values to copy. */
  readonly values = input.required<TweakValues>();
  /** What the button says, until it says whether it copied them. */
  readonly label = input('Copy Hyperparameter Values');

  /** Whether it copied them, for a while after it tried, if it did. */
  private readonly copied = signal<boolean | undefined>(undefined);
  protected readonly shown = computed(() => {
    const copied = this.copied();
    return copied === undefined ? this.label() : copied ? 'Copied' : "Couldn't Copy";
  });
  private readonly writeClipboard = inject(WRITE_CLIPBOARD);
  private readonly clock = inject(RUN_CLOCK);
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected async copy(): Promise<void> {
    try {
      await this.writeClipboard(tweaksBackup(this.values(), this.clock.epoch()));
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.copied.set(undefined);
    }, COPIED_MS);
  }
}
