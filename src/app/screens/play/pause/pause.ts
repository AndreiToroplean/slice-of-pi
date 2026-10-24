import { Component, ElementRef, model, output, viewChild } from '@angular/core';
import { injectBackToMenu } from '../../../ui/back-to-menu';
import { ButtonList } from '../../../ui/button-list';
import { Candy } from '../../../ui/candy';

/**
 * The pause button, and the dialog it opens over the game: resume, restart the game, or end it, back to the main
 * menu. Escape pauses too, and resumes; up and down move between the dialog's buttons, and Enter chooses one, as on
 * any button.
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
        <button type="button" appCandy="danger" (click)="void endGame()">End Game</button>
      </app-button-list>
    </dialog>
  `,
  styleUrl: './pause.css',
})
export class Pause {
  /** Whether the game is paused, with the dialog open. */
  readonly paused = model(false);
  /** The player chose to restart the game. */
  readonly restart = output();

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

  protected resume(): void {
    this.dialog().nativeElement.close();
  }

  /**
   * Back to the main menu. The dialog finishes closing first, so that it doesn't linger over the screens' transition.
   * Its transitions may end cancelled rather than finished, as when the browser hides it at their end: closed all the
   * same.
   */
  protected async endGame(): Promise<void> {
    const dialog = this.dialog().nativeElement;
    dialog.close();
    await Promise.allSettled(dialog.getAnimations().map(async (animation) => animation.finished));
    this.backToMenu();
  }
}
