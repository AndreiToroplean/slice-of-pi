import { Component, input, model } from '@angular/core';

/** Tells segmented controls apart, so that each has its own group of radio buttons. */
let groups = 0;

/** One of the choices of a segmented control: its value, and what its segment says. */
export interface Segment<T extends string> {
  readonly value: T;
  readonly label: string;
}

/**
 * A choice between a few values, as candy buttons side by side: the one chosen stays pressed, and pressing another one
 * presses it instead. Radio buttons underneath, so that the keyboard and assistive technology handle it as one.
 */
@Component({
  selector: 'app-segmented',
  host: { role: 'radiogroup', '[attr.aria-label]': 'label()' },
  template: `
    @for (segment of segments(); track segment.value) {
      <label class="segment" [class.chosen]="segment.value === value()">
        <input
          type="radio"
          class="visually-hidden"
          [name]="name"
          [checked]="segment.value === value()"
          (change)="value.set(segment.value)"
        />
        {{ segment.label }}
      </label>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-auto-columns: 1fr;
      grid-auto-flow: column;
      gap: 0.625rem;
      padding-bottom: 0.3125rem;
    }

    /* A candy button (see \`.candy\` in \`styles.css\`), sunk while chosen. */
    .segment {
      padding: 0.625rem 0.5rem;
      border-radius: var(--radius-key);
      background: var(--candy);
      box-shadow:
        0 0.3125rem 0 var(--candy-edge),
        0 0.5rem 1.25rem rgb(40 20 60 / 18%);
      color: var(--on-candy);
      text-align: center;
      font-family: var(--font-digits);
      font-size: 1.0625rem;
      font-weight: 600;
      -webkit-tap-highlight-color: transparent;
      cursor: pointer;
      transition:
        translate 0.08s,
        box-shadow 0.08s,
        background-color 0.08s;
    }

    .segment.chosen {
      --candy: var(--candy-primary);
      --candy-edge: var(--candy-primary-edge);
      translate: 0 0.25rem;
      box-shadow:
        0 0.0625rem 0 var(--candy-edge),
        0 0.25rem 0.75rem rgb(40 20 60 / 18%);
      cursor: default;
    }

    .segment:has(input:focus-visible) {
      outline: 0.1875rem solid var(--focus-ring);
      outline-offset: 0.25rem;
    }
  `,
})
export class Segmented<T extends string> {
  /** What the choice is called for screen readers. */
  readonly label = input.required<string>();
  readonly segments = input.required<readonly Segment<T>[]>();
  /** The value chosen. */
  readonly value = model.required<T>();

  protected readonly name = `segmented-${String(++groups)}`;
}
