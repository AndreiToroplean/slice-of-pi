import { Service, signal } from '@angular/core';

/**
 * Whether a transition from one screen to the next is running (see `app.config.ts`), for what a screen shows only once
 * it's in place, such as the main menu's light.
 */
@Service()
export class ScreenTransitions {
  private readonly running = signal(0);
  /** Whether no transition is running. */
  readonly settled = (): boolean => this.running() === 0;

  /** Notes a transition starting, settled once it's finished, or skipped. */
  began(finished: Promise<unknown>): void {
    this.running.update((count) => count + 1);
    void finished
      .catch(() => undefined)
      .finally(() => {
        this.running.update((count) => count - 1);
      });
  }
}
