import { Component, ElementRef, inject, input, model, output, viewChild } from '@angular/core';
import { DeveloperMode } from '../../../developer-mode/developer-mode';
import { injectBackToMenu } from '../../../ui/back-to-menu';
import { ButtonList } from '../../../ui/button-list';
import { Candy } from '../../../ui/candy';

/**
 * The pause button, and the dialog it opens over the game: resume, restart the game, stop it and replay the run, once
 * there is one, or end it, back to the main menu. Escape pauses too, and resumes; up and down move between the dialog's buttons, and Enter chooses one, as on
 * any button. In developer mode, it can also show the keypad's touch areas.
 */
@Component({
  selector: 'app-pause',
  imports: [ButtonList, Candy],
  host: { '(document:keydown.escape)': 'escape($event)' },
  template: `
    <button
      type="button"
      appCandy="clear"
      class="corner pause-button"
      aria-label="Pause"
      (click)="pause()"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" rx="1.5" />
        <rect x="14" y="5" width="4" height="14" rx="1.5" />
      </svg>
    </button>
    <dialog #dialog class="card" aria-labelledby="pause-title" (close)="paused.set(false)">
      <h2 id="pause-title">Paused</h2>
      <app-button-list>
        <button type="button" appCandy="primary" autofocus (click)="resume()">Resume</button>
        <button type="button" appCandy (click)="restart.emit(); resume()">Restart</button>
        @if (replayable()) {
          <button type="button" appCandy="danger" (click)="void stopAndReplay()">
            Stop and Replay This Run
          </button>
        }
        <button type="button" appCandy="danger" (click)="void endGame()">End Game</button>
      </app-button-list>
      @if (developerMode.enabled()) {
        <label class="toggle">
          <input
            type="checkbox"
            [checked]="showTouchAreas()"
            (change)="setShowTouchAreas($event)"
          />
          Show Touch Areas
        </label>
      }
    </dialog>
  `,
  styleUrl: './pause.css',
})
export class Pause {
  /** Whether the game is paused, with the dialog open. */
  readonly paused = model(false);
  /** The player chose to restart the game. */
  readonly restart = output();
  /** Whether there's a run to replay. */
  readonly replayable = input(false);
  /** The player chose to stop the game and replay the run, once the dialog has closed. */
  readonly replay = output();
  /** Whether the keypad shows its touch areas, in developer mode. */
  readonly showTouchAreas = model(false);

  protected readonly developerMode = inject(DeveloperMode);

  private readonly backToMenu = injectBackToMenu();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected pause(): void {
    this.dialog().nativeElement.showModal();
    this.paused.set(true);
  }

  /** Pauses, unless already paused: the dialog then closes on Escape by itself. */
  protected escape(event: Event): void {
    if (!this.paused()) {
      // So that the browser doesn't take the same Escape to close the dialog just opened.
      event.preventDefault();
      this.pause();
    }
  }

  protected setShowTouchAreas(event: Event): void {
    this.showTouchAreas.set((event.target as HTMLInputElement).checked);
  }

  protected resume(): void {
    this.dialog().nativeElement.close();
  }

  /**
   * Back to the main menu. The dialog finishes closing first, so that it doesn't linger over the screens' transition.
   * Its transitions may end cancelled rather than finished, as when the browser hides it at their end: closed all the
   * same.
   */
  protected async endGame(): Promise<void> {
    await this.close();
    this.backToMenu();
  }

  /** On to the run's replay, the dialog closed first, as when ending the game. */
  protected async stopAndReplay(): Promise<void> {
    await this.close();
    this.replay.emit();
  }

  private async close(): Promise<void> {
    const dialog = this.dialog().nativeElement;
    dialog.close();
    await Promise.allSettled(dialog.getAnimations().map(async (animation) => animation.finished));
  }
}
