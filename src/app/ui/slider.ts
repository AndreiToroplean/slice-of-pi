import { Component, input, output } from '@angular/core';

let made = 0;

/**
 * A slider setting a value, as Break Models first had them: its name on a line, with, given the value's default, a
 * button to bring it back to it, and buttons of its own, such as a setting's help; the value as it reads on a line of
 * its own under it, so that neither crowds the other; and its track.
 */
@Component({
  selector: 'app-slider',
  template: `
    <div class="top">
      <label [for]="inputId()">{{ label() }}</label>
      <ng-content />
      @if (defaultValue() !== undefined) {
        <button
          type="button"
          class="round"
          title="Back to Default"
          [disabled]="value() === defaultValue()"
          (click)="revert()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
          </svg>
        </button>
      }
    </div>
    @if (valueText(); as text) {
      <output [for]="inputId()">{{ text }}</output>
    }
    <input
      type="range"
      [id]="inputId()"
      [min]="min()"
      [max]="max()"
      [step]="step()"
      [value]="value()"
      [attr.aria-valuetext]="valueText() ?? null"
      (input)="slide($event)"
    />
  `,
  styleUrl: './slider.css',
})
export class Slider {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly step = input(1);
  /** The value as it reads, shown and spoken; none shown if not given. */
  readonly valueText = input<string>();
  /** The value's default, to bring it back to; no button for it if not given. */
  readonly defaultValue = input<number>();
  /** The id of its input, for what labels it or reads it; one of its own if not given. */
  readonly inputId = input(`slider-${String(made++)}`);
  readonly changed = output<number>();

  protected revert(): void {
    const back = this.defaultValue();
    if (back !== undefined) {
      this.changed.emit(back);
    }
  }

  protected slide(event: Event): void {
    this.changed.emit(Number((event.target as HTMLInputElement).value));
  }
}
