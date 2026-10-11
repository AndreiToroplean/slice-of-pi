import { Component, inject, InjectionToken, input, signal } from '@angular/core';

/** Puts text on the clipboard. */
export const WRITE_CLIPBOARD = new InjectionToken<(text: string) => Promise<void>>(
  'WRITE_CLIPBOARD',
  { factory: () => (text) => navigator.clipboard.writeText(text) },
);

/** How long "Copied" shows on the button. */
export const COPIED_MS = 2000;
const LABEL = 'Copy hyperparameter values';

/**
 * The button of a developer mode page that copies the values tuned on it, as text to hand back so they go into the
 * code.
 */
@Component({
  selector: 'app-copy-values',
  template: `<button type="button" class="candy" (click)="void copy()">{{ label() }}</button>`,
  styleUrl: './copy-values.css',
})
export class CopyValues {
  /** The text to copy. */
  readonly text = input.required<string>();

  protected readonly label = signal(LABEL);
  private readonly writeClipboard = inject(WRITE_CLIPBOARD);
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected async copy(): Promise<void> {
    try {
      await this.writeClipboard(this.text());
      this.label.set('Copied');
    } catch {
      this.label.set("Couldn't copy");
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.label.set(LABEL);
    }, COPIED_MS);
  }
}
