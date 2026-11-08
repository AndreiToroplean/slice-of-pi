import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Checkpoint } from '../../player-data/checkpoint';
import { GameMode } from '../../game/modes/game-mode';
import { Candy, CandyLook } from '../../ui/candy';
import { CandyGroup } from '../../ui/candy-group';
import { Spinner } from '../../ui/spinner';

/**
 * A button starting a game mode from the place picked for it, "Discover from 40", as one candy button of two parts
 * (see `CandyGroup`): what it starts, then the place, which the player drags up or down, or across, to pick another
 * checkpoint unlocked, ten places a step (see `Spinner`), kept for the next visits: only what it starts starts the
 * game. Pressing that presses all of it; touching the place doesn't, as it's what's dragged.
 * Told it's sunk, as in a split button's tray before it rises (see `SplitButton`), all of it shows pressed.
 */
@Component({
  selector: 'app-start-from',
  imports: [Candy, CandyGroup, RouterLink, Spinner],
  template: `
    <app-candy-group>
      <a
        #link="appCandy"
        [appCandy]="look()"
        [routerLink]="path()"
        [queryParams]="{ from: place() }"
        [pressed]="sunk() || undefined"
        data-vibration="play"
        >{{ name() }} from</a
      >
      <div [appCandy]="look()" class="place" [pressed]="sunk() || link.held()">
        <app-spinner
          [label]="name() + ' from'"
          [min]="0"
          [max]="checkpoint.farthest()"
          [step]="10"
          [value]="place()"
          data-vibration="play"
          (valueChange)="void checkpoint.pick(mode(), $event)"
        />
      </div>
    </app-candy-group>
  `,
  styles: `
    :host {
      display: block;
      /* The room around the place, which the spinner takes, so that a touch anywhere on that part drags it. */
      --place-padding-block: var(--candy-padding-block, 0.75rem);
    }

    /* On one line. */
    a {
      white-space: nowrap;
    }

    .place {
      --candy-padding-block: 0px;
      --candy-padding-inline: 0px;
      font-family: var(--font-digits);
      touch-action: none;
      cursor: move;
    }

    /* The spinner takes the touches its button's content would let through, and picked out, the button shows it. */
    app-spinner {
      padding: var(--place-padding-block) 0.625rem;
      pointer-events: auto;
    }

    app-spinner:focus-visible {
      box-shadow: none;
    }
  `,
})
export class StartFrom {
  readonly mode = input.required<GameMode>();
  /** The route of the game mode. */
  readonly path = input.required<string>();
  /** What it's called, before "from". */
  readonly name = input.required<string>();
  readonly look = input<CandyLook>('white');
  /** Whether it shows pressed, all of it, as sunk in what holds it. */
  readonly sunk = input(false);

  protected readonly checkpoint = inject(Checkpoint);

  protected place(): number {
    return this.checkpoint.place(this.mode());
  }
}
