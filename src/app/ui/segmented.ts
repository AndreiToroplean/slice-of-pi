import { Component, ElementRef, inject, input, model } from '@angular/core';

/** One of the choices of a segmented control: its value, and what its segment says. */
export interface Segment<T extends string> {
  readonly value: T;
  readonly label: string;
}

/**
 * A choice of one among a few, as simple buttons side by side on a strip, the one chosen filled: pressing another one
 * chooses it instead. A setting, as radio buttons, or, given the panels they show (`panels`), tabs. Either way, Tab
 * stops on the one chosen, and left and right choose the one before or after it. Too many to fit, they scroll sideways,
 * the one chosen into view, rather than squeeze their names. The same everywhere, on the background as on a card: a
 * faint dark strip, the one chosen in ink, the others in the color of the text around them.
 */
@Component({
  selector: 'app-segmented',
  host: {
    '[attr.role]': "panels() === undefined ? 'radiogroup' : 'tablist'",
    '[attr.aria-label]': 'label()',
    '(keydown.arrowleft)': 'step($event, -1)',
    '(keydown.arrowright)': 'step($event, 1)',
  },
  template: `
    @for (segment of segments(); track segment.value) {
      @let chosen = segment.value === value();
      <button
        type="button"
        [attr.role]="panels() === undefined ? 'radio' : 'tab'"
        [attr.aria-checked]="panels() === undefined ? chosen : null"
        [attr.aria-selected]="panels() === undefined ? null : chosen"
        [attr.id]="panels() === undefined ? null : panels() + '-tab-' + segment.value"
        [attr.aria-controls]="panels() === undefined ? null : panels() + '-' + segment.value"
        [tabIndex]="chosen ? 0 : -1"
        (click)="choose(segment.value)"
      >
        {{ segment.label }}
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      gap: 0.25rem;
      padding: 0.1875rem;
      border-radius: 1rem;
      background: rgb(30 20 60 / 10%);
      font-size: 0.8125rem;
      font-weight: 500;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
    }

    button {
      /* As wide as its name, sharing what width is left. */
      flex: 1 0 auto;
      padding: 0.5rem 0.375rem;
      border: none;
      border-radius: 0.8125rem;
      background: none;
      color: inherit;
      font: inherit;
      text-shadow: inherit;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    [aria-checked='true'],
    [aria-selected='true'] {
      background: var(--ink);
      color: #ffffff;
      text-shadow: none;
    }

    /* Glowing when picked out, as a simple button does. */
    button:focus-visible {
      outline: 0.1875rem solid transparent;
      box-shadow: var(--selected-glow);
    }
  `,
})
export class Segmented<T extends string> {
  /** What the choice is called for screen readers. */
  readonly label = input.required<string>();
  readonly segments = input.required<readonly Segment<T>[]>();
  /** The value chosen. */
  readonly value = model.required<T>();
  /**
   * Makes them tabs, each showing the panel whose id is this and its value, as `perspective-run`, and with its own id
   * this, `-tab-` and its value, as `perspective-tab-run`, for the panel to be labelled by.
   */
  readonly panels = input<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected choose(value: T): void {
    this.value.set(value);
    this.scrollTo(this.segments().findIndex((segment) => segment.value === value));
  }

  /** Chooses the one `offset` after the one chosen, before if negative, round from either end, and moves onto it. */
  protected step(event: Event, offset: number): void {
    event.preventDefault();
    const segments = this.segments();
    const index = segments.findIndex((segment) => segment.value === this.value());
    const next = (index + offset + segments.length) % segments.length;
    const segment = segments[next];
    if (segment !== undefined) {
      this.choose(segment.value);
      this.buttons()[next]?.focus();
    }
  }

  /** Scrolls the strip to show the whole of a button. */
  private scrollTo(index: number): void {
    const button = this.buttons()[index];
    if (button === undefined) {
      return;
    }
    const [shown, all] = [button.getBoundingClientRect(), this.host.getBoundingClientRect()];
    this.host.scrollLeft +=
      Math.min(0, shown.left - all.left) + Math.max(0, shown.right - all.right);
  }

  private buttons(): HTMLButtonElement[] {
    return Array.from(this.host.querySelectorAll('button'));
  }
}
