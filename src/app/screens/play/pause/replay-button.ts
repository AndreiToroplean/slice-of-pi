import { Component, input, output } from '@angular/core';
import { Candy } from '../../../ui/candy';

/**
 * The corner button of the pause and game over dialogs that stops the game and replays its run, its icon a circling
 * arrow round a play sign.
 */
@Component({
  selector: 'app-replay-button',
  imports: [Candy],
  template: `
    <button
      type="button"
      appCandy="clear"
      class="corner"
      title="Replay This Run"
      [disabled]="disabled()"
      (click)="pressed.emit()"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 12A7.5 7.5 0 1 0 12 4.5M14.5 2 12 4.5 14.5 7" />
        <path class="play" d="M10.5 9.25 14.75 12l-4.25 2.75z" />
      </svg>
    </button>
  `,
  styles: `
    :host {
      display: grid;
    }

    svg {
      width: 1.1em;
      height: 1.1em;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .play {
      fill: currentColor;
    }
  `,
})
export class ReplayButton {
  /** Whether there's no run to replay yet. */
  readonly disabled = input(false);
  /** The player pressed it. */
  readonly pressed = output();
}
