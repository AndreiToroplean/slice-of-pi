import { Component, inject, input, model, output, viewChild } from '@angular/core';
import { DeveloperMode } from '../../../developer-mode/developer-mode';
import { injectBackToMenu } from '../../../ui/back-to-menu';
import { Candy } from '../../../ui/candy';
import { ChoiceDialog } from '../../../ui/choice-dialog';
import { ReplayButton } from './replay-button';

/**
 * The pause key, a see-through key of the keypad, in its corner left of 0 (see `Keypad`), and the dialog it opens over
 * the game, two thirds of the way down the screen, within the thumb's reach: resume, restart the game, or end it, back to the main menu;
 * a button in the dialog's left corner also stops the game and replays the run, once there's one and the player has
 * confirmed it, warned that the game can't be resumed then. Escape pauses too, as going back does (see `Play`), and
 * resumes, or goes back from the confirmation, as do going back and a click outside the dialog; up and down move between a dialog's
 * buttons, and Enter chooses one, as on any button. In developer mode, a button in its right corner also puts the play screen
 * in edit mode, the game staying paused until it's done.
 *
 * Once a game is lost, as on a challenge's mistake, the game over dialog takes the pause dialog's place: there's no
 * resuming, only playing again, continuing the run in free play, or going back to the main menu, and nothing else
 * closes it; its replay button replays the run at once, as there's no game left to warn about. Its dialogs are choice
 * dialogs (see `ChoiceDialog`), within the thumb's reach.
 */
@Component({
  selector: 'app-pause',
  imports: [Candy, ChoiceDialog, ReplayButton],
  host: { '(document:keydown.escape)': 'escape($event)' },
  template: `
    <button type="button" appCandy="clear" class="pause-button" title="Pause" (click)="pause()">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" rx="1.5" />
        <rect x="14" y="5" width="4" height="14" rx="1.5" />
      </svg>
    </button>
    <app-choice-dialog #dialog heading="Paused" [inReach]="true" (closed)="closed()">
      <app-replay-button cornerStart [disabled]="!replayable()" (pressed)="askToReplay()" />
      @if (developerMode.enabled()) {
        <button
          cornerEnd
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
      <button type="button" appCandy="primary" (click)="resume()">Resume</button>
      <button type="button" appCandy (click)="restart.emit(); resume()">Restart</button>
      <button type="button" appCandy="danger" (click)="void endGame()">End Game</button>
    </app-choice-dialog>
    <app-choice-dialog
      #overDialog
      heading="Game Over"
      [inReach]="true"
      [dismissable]="false"
      (closed)="closed()"
    >
      <app-replay-button cornerStart [disabled]="!replayable()" (pressed)="void stopAndReplay()" />
      <button type="button" appCandy="primary" (click)="playAgain()">Play Again</button>
      @if (continuable()) {
        <button type="button" appCandy (click)="continueInFreePlay()">Continue in Free Play</button>
      }
      <button type="button" appCandy (click)="void endGame()">Main Menu</button>
    </app-choice-dialog>
    <app-choice-dialog #replayDialog heading="Watch the Replay?" [inReach]="true">
      <p>Your game ends here: you won’t be able to resume it.</p>
      <button type="button" appCandy (click)="void replayDialog.close()">Back</button>
      <button type="button" appCandy="danger" (click)="void stopAndReplay()">Watch Replay</button>
    </app-choice-dialog>
  `,
  styleUrl: './pause.css',
})
export class Pause {
  /** Whether the game is paused, with the dialog open. */
  readonly paused = model(false);
  /** The player chose to restart the game. */
  readonly restart = output();
  /** The player chose to carry a lost game on in free play, as the game over dialog closes. */
  readonly freePlay = output();
  /** Whether a lost game can go on in free play, as a challenge can. */
  readonly continuable = input(true);
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
  private readonly dialog = viewChild.required<ChoiceDialog>('dialog');
  private readonly replayDialog = viewChild.required<ChoiceDialog>('replayDialog');
  private readonly overDialog = viewChild.required<ChoiceDialog>('overDialog');

  /** Pauses, opening the dialog, as the pause button does. */
  pause(): void {
    this.dialog().open();
    this.paused.set(true);
  }

  /** Opens the game over dialog, once the game is lost, in place of the pause dialog if it's open. */
  gameOver(): void {
    // Closed as the game is over: closing it mustn't resume the game.
    this.editing = false;
    void this.dialog().close();
    void this.replayDialog().close();
    this.overDialog().open();
    this.paused.set(true);
  }

  /** Restarts the game, from the game over dialog, which closes. */
  protected playAgain(): void {
    this.restart.emit();
    // At once, rather than once the dialog has closed: keys typed as it goes count.
    this.paused.set(false);
    void this.overDialog().close();
  }

  /** Carries the lost game on in free play, from the game over dialog, which closes. */
  protected continueInFreePlay(): void {
    this.freePlay.emit();
    // At once, rather than once the dialog has closed: keys typed as it goes count.
    this.paused.set(false);
    void this.overDialog().close();
  }

  /**
   * Going back: pauses, or resumes, or goes back from the confirmation, as Escape does, by whether the dialogs are open
   * (see `escape`); the game over dialog stays, as the game can't resume.
   */
  back(): void {
    const replayDialog = this.replayDialog();
    if (replayDialog.isOpen) {
      void replayDialog.close();
    } else if (this.dialog().isOpen) {
      this.resume();
    } else if (!this.overDialog().isOpen) {
      this.pause();
    }
  }

  /**
   * Pauses, unless the dialog is open: it then closes on Escape by itself. Whether it's open, rather than paused, which
   * only follows once it has closed: closed at once, without motion, it opens again on the next Escape, however soon.
   */
  protected escape(event: Event): void {
    if (!this.dialog().isOpen && !this.overDialog().isOpen && !this.replayDialog().isOpen) {
      // So that the browser doesn't take the same Escape to close the dialog just opened.
      event.preventDefault();
      this.pause();
    }
  }

  protected editLayout(): void {
    this.editing = true;
    this.resume();
  }

  /**
   * A dialog closed: the game resumes, unless the player chose to edit the layout, or the game over dialog took the
   * pause dialog's place, or the pause dialog opened again since.
   */
  protected closed(): void {
    if (this.editing) {
      this.editing = false;
      this.edit.emit();
    } else if (!this.overDialog().isOpen && !this.dialog().isOpen) {
      this.paused.set(false);
    }
  }

  /** Resumes at once, rather than once the dialog has closed, so that keys typed as it goes count, unless editing. */
  protected resume(): void {
    if (!this.editing) {
      this.paused.set(false);
    }
    void this.dialog().close();
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
    this.replayDialog().open();
  }

  /** On to the run's replay, the dialogs closed first, as when ending the game. */
  protected async stopAndReplay(): Promise<void> {
    await Promise.all([this.replayDialog().close(), this.close()]);
    this.replay.emit();
  }

  /** Closes the pause and game over dialogs, settling once they're closed. */
  private async close(): Promise<void> {
    await Promise.all([this.dialog().close(), this.overDialog().close()]);
  }
}
