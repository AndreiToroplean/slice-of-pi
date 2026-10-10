import { Location } from '@angular/common';
import { Component, ElementRef, inject, model, output, viewChild } from '@angular/core';
import { Router } from '@angular/router';

/**
 * The pause button, and the dialog it opens over the game: resume, restart the game, or end it, back to the main
 * menu. Escape resumes too.
 */
@Component({
  selector: 'app-pause',
  template: `
    <button type="button" class="frosted pause-button" aria-label="Pause" (click)="pause()">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" rx="1.5" />
        <rect x="14" y="5" width="4" height="14" rx="1.5" />
      </svg>
    </button>
    <dialog #dialog aria-labelledby="pause-title" (close)="paused.set(false)">
      <h2 id="pause-title">Paused</h2>
      <button type="button" class="candy primary" autofocus (click)="resume()">Resume</button>
      <button type="button" class="candy" (click)="restart.emit(); resume()">Restart</button>
      <button type="button" class="candy danger" (click)="void endGame()">End game</button>
    </dialog>
  `,
  styleUrl: './pause.css',
})
export class Pause {
  /** Whether the game is paused, with the dialog open. */
  readonly paused = model(false);
  /** The player chose to restart the game. */
  readonly restart = output();

  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected pause(): void {
    this.dialog().nativeElement.showModal();
    this.paused.set(true);
  }

  protected resume(): void {
    this.dialog().nativeElement.close();
  }

  /**
   * Back to the main menu. The history holds at most the main menu and the game over it, so that going back from the
   * game leads to the main menu, and from the main menu out of the app: when the game was started from the main menu,
   * ending it goes back to it, and otherwise the main menu takes the game's place. The dialog finishes closing first,
   * so that it doesn't linger over the screens' transition.
   */
  protected async endGame(): Promise<void> {
    const dialog = this.dialog().nativeElement;
    dialog.close();
    await Promise.all(dialog.getAnimations().map(async (animation) => animation.finished));
    const previous = this.router.lastSuccessfulNavigation()?.previousNavigation;
    if (previous?.finalUrl?.toString() === '/') {
      this.location.back();
    } else {
      void this.router.navigateByUrl('/', { replaceUrl: true });
    }
  }
}
