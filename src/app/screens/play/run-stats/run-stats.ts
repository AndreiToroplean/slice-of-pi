import { Component, computed, input } from '@angular/core';
import { Icon } from '../../../ui/icon';
import { splitTime } from '../../leaderboards/fastest';
import { masteryTenths, ReachedSplit } from '../../leaderboards/records';

/** What shows for the time of the place the splits count from, until it's reached. */
const NOT_YET = '–';

/**
 * What the leaderboards will make of the run being played, in a quiet row under the season header: the time since
 * its first digit, the last split place it reached, in an oval, and when, its mistakes, and its mastery, each under its
 * icon, white, as the season header shows the season's. It can look unavailable, as while the game is held still,
 * whatever it shows then being up to what shows it.
 */
@Component({
  selector: 'app-run-stats',
  imports: [Icon],
  host: { '[class.disabled]': 'disabled()' },
  template: `
    <dl>
      <div>
        <dt class="visually-hidden">Time</dt>
        <dd>
          <app-icon name="stopwatch" />
          <span class="number">{{ time() }}</span>
        </dd>
      </div>
      <div>
        @let shown = shownSplit();
        <dt class="visually-hidden">Last split</dt>
        <dd>
          <span class="place">{{ shown.place }}</span>
          <span class="number">{{ shown.time }}</span>
        </dd>
      </div>
      <div>
        <dt class="visually-hidden">Mistakes</dt>
        <dd>
          <app-icon name="mistakes" />
          <span class="number">{{ mistakes() }}</span>
        </dd>
      </div>
      <div>
        <dt class="visually-hidden">Mastery</dt>
        <dd>
          <app-icon name="mastery" />
          <span class="number">{{ shownMastery() }}</span>
        </dd>
      </div>
    </dl>
  `,
  styles: `
    /*
     * Each stat in a cell of its own, all as wide, together as wide as the season header's year bar above them, its
     * icon, or the split's place, over its number, both centered in it: the icons stand evenly spaced, and never move as
     * the numbers change, which grow evenly on both sides under them.
     */
    dl {
      margin: 0;
      display: grid;
      grid-template-columns: repeat(4, 4.2em);
      justify-content: center;
      align-items: center;
      opacity: 0.9;
      text-shadow: var(--text-shadow);
    }

    /* Faded as much as an unavailable button's paint. */
    :host(.disabled) dl {
      opacity: calc(var(--unavailable, 100) * 0.9%);
    }

    dd {
      margin: 0;
      display: grid;
      grid-template-rows: 1.35em auto;
      justify-items: center;
      align-items: center;
      gap: 0.15em;
    }

    .number {
      font-family: var(--font-digits);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    /* As the season header's season icon. */
    app-icon {
      font-size: 1.2em;
      filter: drop-shadow(0 1px 4px rgb(0 0 0 / 18%));
    }

    /* The split's place, in a white oval, shadowed as the icons are. */
    .place {
      padding: 0 0.45em;
      border: 0.1em solid;
      border-radius: 100vmax;
      font-family: var(--font-digits);
      font-size: 0.85em;
      font-weight: 600;
      line-height: 1.3;
      filter: drop-shadow(0 1px 4px rgb(0 0 0 / 18%));
    }
  `,
})
export class RunStats {
  /** How long it's been since the run's first digit, in milliseconds. */
  readonly elapsed = input.required<number>();
  /** The last split place the run reached, or the place it counts from, with no time until reached. */
  readonly split = input.required<ReachedSplit>();
  /** The run's mistakes, those at the place being typed included. */
  readonly mistakes = input.required<number>();
  /** Whether it stands still and looks unavailable, as while the game is held still. */
  readonly disabled = input(false);
  /** The run's mastery, unrounded. */
  readonly mastery = input.required<number>();

  protected readonly time = computed(() => splitTime(this.elapsed()));
  protected readonly shownSplit = computed(() => {
    const split = this.split();
    return {
      place: split.place,
      time: split.time === undefined ? NOT_YET : splitTime(split.time),
    };
  });
  protected readonly shownMastery = computed(() => masteryTenths(this.mastery()).toFixed(1));
}
