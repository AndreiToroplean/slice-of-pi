import { Component, inject } from '@angular/core';
import { RunsState } from './runs-state';

/**
 * The line the game plays from among the runs, as if the runs after it had never been played: "You are here", across,
 * with a button to play from after all the runs again. The line is a tweak, so it only shows in developer mode.
 */
@Component({
  selector: 'app-here-line',
  host: { class: 'here', role: 'group', 'aria-label': 'You are here' },
  template: `
    <span>You are here</span>
    <button
      type="button"
      class="undo"
      title="Play from after all the runs again"
      (click)="state.undoPlayFrom()"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
      </svg>
    </button>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-family: var(--font-digits);
      font-weight: 600;
      text-shadow: var(--text-shadow);

      &::before,
      &::after {
        content: '';
        flex: 1;
        border-top: 2px solid currentColor;
      }
    }

    /* Like the buttons bringing back a grouping setting. */
    .undo {
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: var(--frost-pressed);
      color: inherit;
      cursor: pointer;

      & svg {
        width: 1rem;
        height: 1rem;
        fill: none;
        stroke: currentColor;
        stroke-width: 2.4;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      &:focus-visible {
        outline: 0.1875rem solid var(--focus-ring);
        outline-offset: 0.125rem;
      }
    }
  `,
})
export class HereLine {
  protected readonly state = inject(RunsState);
}
