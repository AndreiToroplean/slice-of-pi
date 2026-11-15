import { Component, input, output } from '@angular/core';
import { Candy } from '../../../ui/candy';
import { Icon } from '../../../ui/icon';

/**
 * The corner button of the pause and game over dialogs that stops the game and replays its run, its icon a strip of film.
 */
@Component({
  selector: 'app-replay-button',
  imports: [Candy, Icon],
  template: `
    <button
      type="button"
      appCandy="clear"
      class="corner"
      title="Replay This Run"
      [disabled]="disabled()"
      (click)="pressed.emit()"
    >
      <app-icon name="replay" />
    </button>
  `,
  styles: `
    :host {
      display: grid;
    }
  `,
})
export class ReplayButton {
  /** Whether there's no run to replay yet. */
  readonly disabled = input(false);
  /** The player pressed it. */
  readonly pressed = output();
}
