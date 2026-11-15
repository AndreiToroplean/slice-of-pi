import { Component, computed, input } from '@angular/core';
import { SeasonView } from '../../../game/layers/seasons';
import { Icon } from '../../../ui/icon';

/** Each season's name, as shown. */
export const SEASON_NAMES = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
} as const;

/** The season header: the places typed, the season's icon and name, the year, and the four-part year bar. */
@Component({
  selector: 'app-season-header',
  imports: [Icon],
  template: `
    <p class="count">Digit {{ view().places }}</p>
    <p class="season">
      <app-icon [name]="view().season" />
      <span>{{ name() }} · Year {{ view().year }}</span>
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
}
