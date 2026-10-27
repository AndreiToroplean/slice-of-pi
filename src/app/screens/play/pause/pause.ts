import { Component, ElementRef, inject, input, model, output, viewChild } from '@angular/core';
import { DeveloperMode } from '../../../developer-mode/developer-mode';
import { injectBackToMenu } from '../../../ui/back-to-menu';
import { ButtonList } from '../../../ui/button-list';
import { Candy } from '../../../ui/candy';
import { LightDismiss } from '../../../ui/light-dismiss';

/**
 * The pause button, and the dialog it opens over the game: resume, restart the game, or end it, back to the main menu;
 * a button in the dialog's left corner also stops the game and replays the run, once there's one and the player has
 * confirmed it, warned that the game can't be resumed then. Escape pauses too, as going back does (see `Play`), and
 * resumes, or goes back from the confirmation, as do going back and a click outside the dialog; up and down move between a dialog's
 * buttons, and Enter chooses one, as on any button. In developer mode, a button in its right corner also puts the play screen
 * in edit mode, the game staying paused until it's done.
 */
@Component({
  selector: 'app-pause',
  imports: [ButtonList, Candy, LightDismiss],
  host: { '(document:keydown.escape)': 'escape($event)' },
  template: `
    <button
      type="button"
      appCandy="clear"
      class="corner pause-button"
      title="Pause"
      (click)="pause()"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" rx="1.5" />
        <rect x="14" y="5" width="4" height="14" rx="1.5" />
      </svg>
    </button>
    <dialog #dialog class="card" closedby="any" aria-labelledby="pause-title" (close)="closed()">
      <div class="heading">
        <h2 id="pause-title">Paused</h2>
        <button
          type="button"
          appCandy="clear"
          class="corner replay-button"
          [disabled]="!replayable()"
          title="Replay This Run"
          (click)="askToReplay()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4.5 12A7.5 7.5 0 1 0 12 4.5M14.5 2 12 4.5 14.5 7" />
            <path class="play" d="M10.5 9.25 14.75 12l-4.25 2.75z" />
          </svg>
        </button>
        @if (developerMode.enabled()) {
          <button
            type="button"
            appCandy="clear"
            class="corner edit-button"
            title="Edit Layout"
            (click)="editLayout()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.5 19.5h4l10-10-4-4-10 10z" />
              <path d="m12.5 7.5 4 4" />
            </svg>
          </button>
        }
      </div>
      <app-button-list>
        <button type="button" appCandy="primary" autofocus (click)="resume()">Resume</button>
        <button type="button" appCandy (click)="restart.emit(); resume()">Restart</button>
        <button type="button" appCandy="danger" (click)="void endGame()">End Game</button>
      </app-button-list>
    </dialog>
    <dialog
      #replayDialog
      class="card"
      closedby="any"
      aria-labelledby="replay-title"
      aria-describedby="replay-warning"
    >
      <h2 id="replay-title">Watch the Replay?</h2>
      <p id="replay-warning" class="warning">
        Your game ends here: you won’t be able to resume it.
      </p>
      <app-button-list>
        <button type="button" appCandy autofocus (click)="replayDialog.close()">Back</button>
        <button type="button" appCandy="danger" (click)="void stopAndReplay()">Watch Replay</button>
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
  /** Whether there's a run to replay. */
  readonly replayable = input(false);
  /** The player chose to stop the game and replay the run, once the dialog has closed. */
  readonly replay = output();
  /** The player chose to edit the layout, once the dialog has closed: the game stays paused meanwhile. */
  readonly edit = output();

  protected readonly developerMode = inject(DeveloperMode);

  /** Whether the player chose to end the game, going back to the main menu. */
  ending = false;
  /** Whether the player chose to edit the layout, as the dialog closes. */
  private editing = false;

  private readonly backToMenu = injectBackToMenu();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly replayDialog = viewChild.required<ElementRef<HTMLDialogElement>>('replayDialog');

  /** Pauses, opening the dialog, as the pause button does. */
  pause(): void {
    this.dialog().nativeElement.showModal();
    this.paused.set(true);
  }

  /** Going back: pauses, or resumes, or goes back from the confirmation, as Escape does. */
  back(): void {
    const replayDialog = this.replayDialog().nativeElement;
    if (replayDialog.open) {
      replayDialog.close();
    } else if (this.paused()) {
      this.resume();
    } else {
      this.pause();
    }
  }

  /** Pauses, unless already paused: the dialog then closes on Escape by itself. */
  protected escape(event: Event): void {
    if (!this.paused()) {
      // So that the browser doesn't take the same Escape to close the dialog just opened.
      event.preventDefault();
      this.pause();
    }
  }

  protected editLayout(): void {
    this.editing = true;
    this.resume();
  }

  /** The dialog closed: the game resumes, unless the player chose to edit the layout. */
  protected closed(): void {
    if (this.editing) {
      this.editing = false;
      this.edit.emit();
    } else {
      this.paused.set(false);
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
    await this.close();
    this.ending = true;
    this.backToMenu();
  }

  protected askToReplay(): void {
    this.replayDialog().nativeElement.showModal();
  }

  /** On to the run's replay, the dialogs closed first, as when ending the game. */
  protected async stopAndReplay(): Promise<void> {
    await Promise.all([close(this.replayDialog().nativeElement), this.close()]);
    this.replay.emit();
  }

  private async close(): Promise<void> {
    await close(this.dialog().nativeElement);
  }
}

/** Closes a dialog, once its transitions have ended. */
async function close(dialog: HTMLDialogElement): Promise<void> {
  dialog.close();
  await Promise.allSettled(dialog.getAnimations().map(async (animation) => animation.finished));
}
