import { FocusKeyManager } from '@angular/cdk/a11y';
import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  viewChild,
  viewChildren,
} from '@angular/core';

/** One of the choices of a segmented control: its value, and what its segment says. */
export interface Segment<T extends string> {
  readonly value: T;
  readonly label: string;
}

/**
 * A choice of one among a few, as simple buttons side by side on a strip, the one chosen filled: pressing another one
 * chooses it instead. A setting, as radio buttons, or, given the panels they show (`panels`), tabs. Either way, Tab
 * stops on the one chosen, and the arrow keys choose the one before or after it, round, and Home and End the first and
 * the last, as the CDK's focus key manager moves the focus. Too many to fit, they scroll sideways,
 * the one chosen into view, rather than squeeze their names. The same everywhere, on the background as on a card: a
 * faint dark strip, the one chosen on a white pill, as a white candy button, the others in the color of the text around
 * them. Choosing another one slides the pill over to it, fitting it, as its name fades to the pill's text color.
 */
@Component({
  selector: 'app-segmented',
  host: {
    '[attr.role]': "panels() === undefined ? 'radiogroup' : 'tablist'",
    '[attr.aria-label]': 'label()',
    '(keydown)': 'keydown($event)',
    '(window:resize)': 'place()',
  },
  template: `
    <span #pill class="chosen-pill" aria-hidden="true"></span>
    @for (segment of segments(); track segment.value) {
      @let chosen = segment.value === value();
      <button
        #segment
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
      position: relative;
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

    /* Under the one chosen, sliding to the next one chosen. */
    .chosen-pill {
      position: absolute;
      inset-block: 0.1875rem;
      left: 0;
      border-radius: 0.8125rem;
      background: var(--candy);
      transition:
        translate 0.25s var(--ease),
        width 0.25s var(--ease);
    }

    button {
      position: relative;
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
      transition: color 0.25s var(--ease);
    }

    [aria-checked='true'],
    [aria-selected='true'] {
      color: var(--on-candy);
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
  private readonly pill = viewChild.required<ElementRef<HTMLElement>>('pill');
  private readonly segmentRefs = viewChildren<ElementRef<HTMLButtonElement>>('segment');
  private readonly buttons = computed(() => this.segmentRefs().map((ref) => ref.nativeElement));
  /** Moves the focus through them with the arrow keys, and Home and End, round, as for any group of options. */
  private readonly keys = new FocusKeyManager(
    computed(() =>
      this.buttons().map((button) => ({
        focus: () => {
          button.focus();
        },
      })),
    ),
    inject(Injector),
  )
    .withHorizontalOrientation('ltr')
    .withVerticalOrientation(false)
    .withWrap()
    .withHomeAndEnd();
  /** Whether the pill is under the one chosen yet, from which it then slides to the next. */
  private placed = false;

  constructor() {
    afterRenderEffect(() => {
      this.value();
      this.segments();
      this.place();
    });
    // Again once the names' font has arrived, which can change how wide they are.
    const fonts = inject(DOCUMENT).fonts;
    afterNextRender(() => {
      void fonts.ready.then(() => {
        this.place();
      });
    });
  }

  /** Moves the pill under the one chosen, fitting it: at once the first time, sliding there after that. */
  protected place(): void {
    const chosen = this.buttons().find((button) => button.tabIndex === 0);
    if (chosen === undefined) {
      return;
    }
    const pill = this.pill().nativeElement;
    pill.style.transition = this.placed ? '' : 'none';
    pill.style.translate = `${String(chosen.offsetLeft)}px`;
    pill.style.width = `${String(chosen.offsetWidth)}px`;
    if (!this.placed) {
      // Laid out where it starts before it can slide.
      pill.getBoundingClientRect();
      pill.style.transition = '';
      this.placed = true;
    }
  }

  protected choose(value: T): void {
    this.value.set(value);
    this.scrollTo(this.segments().findIndex((segment) => segment.value === value));
  }

  /** Chooses the one the keyboard moves onto, from the one chosen. */
  protected keydown(event: KeyboardEvent): void {
    const segments = this.segments();
    const chosen = segments.findIndex((segment) => segment.value === this.value());
    this.keys.updateActiveItem(chosen);
    this.keys.onKeydown(event);
    const segment = segments[this.keys.activeItemIndex ?? chosen];
    if (this.keys.activeItemIndex !== chosen && segment !== undefined) {
      this.choose(segment.value);
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
}
