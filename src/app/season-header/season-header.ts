import { Component, computed, input } from '@angular/core';
import { PLACES_PER_YEAR, SeasonView } from '../seasons/seasons';

const SEASON_NAMES = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
} as const;

/** The season header: the season's icon and name, the year and place in it, and the four-part year bar. */
@Component({
  selector: 'app-season-header',
  template: `
    <p class="name">
      @switch (view().season) {
        @case ('spring') {
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="#fff">
            <circle cx="12" cy="6" r="3.6" />
            <circle cx="17.7" cy="10.2" r="3.6" />
            <circle cx="15.5" cy="17" r="3.6" />
            <circle cx="8.5" cy="17" r="3.6" />
            <circle cx="6.3" cy="10.2" r="3.6" />
            <circle cx="12" cy="12" r="2.6" fill="#ffd36b" />
          </svg>
        }
        @case ('summer') {
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="#fff"
            stroke-width="2.2"
            stroke-linecap="round"
          >
            <circle cx="12" cy="12" r="4.6" fill="#fff" />
            <path
              d="M12 1.8v2.8M12 19.4v2.8M1.8 12h2.8M19.4 12h2.8M4.8 4.8l2 2M17.2 17.2l2 2M4.8 19.2l2-2M17.2 6.8l2-2"
            />
          </svg>
        }
        @case ('autumn') {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#fff"
              d="M20 3C10 3 4 8 4 15c0 2 .6 3.7 1.6 5 1-4 4-8 9-10-4 3-6.6 6.4-7.7 10.4C8.4 21.4 9.8 22 11.5 22 18 22 21 15 20 3z"
            />
          </svg>
        }
        @case ('winter') {
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="#fff"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path
              d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5"
            />
          </svg>
        }
      }
      <span>{{ name() }}</span>
    </p>
    <p class="place">
      Year {{ view().year }} · digit {{ view().placeInYear }} of {{ placesPerYear }}
    </p>
    <div class="year" aria-hidden="true">
      @for (progress of view().seasonProgress; track $index) {
        <span><i [style.width.%]="progress * 100"></i></span>
      }
    </div>
  `,
  styleUrl: './season-header.css',
})
export class SeasonHeader {
  readonly view = input.required<SeasonView>();

  protected readonly name = computed(() => SEASON_NAMES[this.view().season]);
  protected readonly placesPerYear = PLACES_PER_YEAR;
}
