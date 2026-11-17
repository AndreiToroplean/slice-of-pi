import { FocusKeyManager } from '@angular/cdk/a11y';
import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  Signal,
  viewChild,
  viewChildren,
} from '@angular/core';

/** How wide the pill's middle is before it's stretched, in CSS pixels. */
const MIDDLE = 100;

/** One of the choices of a segmented control: its value, and what its segment says. */
export interface Segment<T extends string> {
  readonly value: T;
  readonly label: string;
}

/**
 * Panels a segmented control's tabs show, side by side, swiped from one to the next (`TabPanels`): how far they're
 * scrolled, in panels, and, where the browser has them, the timeline of their scrolling, for the pill to follow it.
 */
export interface SwipedPanels {
  readonly position: Signal<number>;
  readonly timeline: AnimationTimeline | undefined;
}

/**
 * A choice of one among a few, as simple buttons side by side on a strip, the one chosen filled: pressing another one
 * chooses it instead. A setting, as radio buttons, or, given the panels they show (`panels`), tabs. Either way, Tab
 * stops on the one chosen, and the arrow keys choose the one before or after it, round, and Home and End the first and
 * the last, as the CDK's focus key manager moves the focus. Too many to fit, they scroll sideways,
 * the one chosen into view, rather than squeeze their names. The same everywhere, on the background as on a card: a
 * faint dark strip, the one chosen on a white pill, as a white candy button, the others in the color of the text around
 * them. Choosing another one slides the pill over to it, fitting it, as its name fades to the pill's text color; given
 * its panels, the pill and the names' colors follow them as they're swiped, or slide in as one is chosen. Where the
 * browser has scroll-driven animations, it moves them itself, from how far the panels are scrolled: set from script at
 * every scroll, they'd lag a frame or more behind, the more the busier the page is, and judder. And it moves them
 * without the page's main thread, along with the scrolling, as both are only ever moved (`transform`) and faded
 * (`opacity`): the pill is its two rounded ends and a middle stretched between them, rather than one box as wide as a
 * name, and each name fades from a copy in the color around it to one in the pill's, rather than mixing the two.
 */
@Component({
  selector: 'app-segmented',
  host: {
    '[attr.role]': "panels() === undefined ? 'radiogroup' : 'tablist'",
    '[attr.aria-label]': 'label()',
    '(keydown)': 'keydown($event)',
    '(window:resize)': 'place()',
    '[class.following]': 'follows() !== undefined',
  },
  template: `
    <span class="chosen-pill" aria-hidden="true">
      <span #pillStart class="pill-part start"></span>
      <span #pillMiddle class="pill-part middle"></span>
      <span #pillEnd class="pill-part end"></span>
    </span>
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
        [attr.data-label]="segment.label"
        [style.--on-pill]="onPill()[$index]"
        (click)="choose(segment.value)"
      >
        <span class="name">{{ segment.label }}</span>
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

    /* Under the one chosen, sliding to the next one chosen: its parts, each moved from the left edge. */
    .chosen-pill {
      position: absolute;
      inset-block: 0.1875rem;
      left: 0;
    }

    .pill-part {
      position: absolute;
      inset-block: 0;
      left: 0;
      background: var(--candy);
      transform-origin: left;
      transition: transform 0.25s var(--ease);
    }

    .start,
    .end {
      width: 0.8125rem;
    }

    .start {
      border-radius: 0.8125rem 0 0 0.8125rem;
    }

    .end {
      border-radius: 0 0.8125rem 0.8125rem 0;
    }

    /* Stretched from a set width, which its scale is worked out from (see \`MIDDLE\`). */
    .middle {
      width: 100px;
    }

    button {
      position: relative;
      /* As wide as its name, sharing what width is left. */
      flex: 1 0 auto;
      padding: 0.5rem 0.375rem;
      border: none;
      border-radius: 0.8125rem;
      background: none;
      display: grid;
      color: inherit;
      font: inherit;
      text-shadow: inherit;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    /*
     * Its name twice, one over the other: in the color of the text around it, fading out as much as the pill is under
     * it (\`--on-pill\`, from 0 to 1), and in the pill's, fading in, for the eye alone, as screen readers read it once.
     */
    .name,
    button::after {
      grid-area: 1 / 1;
      transition: opacity 0.25s var(--ease);
    }

    .name {
      opacity: calc(1 - var(--on-pill, 0));
    }

    button::after {
      content: attr(data-label) / '';
      color: var(--on-candy);
      text-shadow: none;
      opacity: var(--on-pill, 0);
    }

    /* Following its panels as they're swiped, at once. */
    :host(.following) .name,
    :host(.following) button::after,
    :host(.following) .pill-part {
      transition: none;
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
  /**
   * The panels the pill follows as they're swiped (`TabPanels`), as far as they're scrolled: 1 under the second tab,
   * 1.5 halfway from it to the third. Without them, the pill slides to the one chosen.
   */
  readonly follows = input<SwipedPanels>();
  /** Where the pill follows the panels from script, at each scroll: where the browser can't animate it from them. */
  private readonly position = computed(() => {
    const panels = this.follows();
    return panels?.timeline === undefined ? panels?.position() : undefined;
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly pillStart = viewChild.required<ElementRef<HTMLElement>>('pillStart');
  private readonly pillMiddle = viewChild.required<ElementRef<HTMLElement>>('pillMiddle');
  private readonly pillEnd = viewChild.required<ElementRef<HTMLElement>>('pillEnd');
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
  /**
   * How much of the pill is under each of them, from 0 to 1: all of it under the one chosen, or, following its panels,
   * shared between the two whose panels are in view, as far as they've been swiped.
   */
  protected readonly onPill = computed(() => {
    const position =
      this.position() ?? this.segments().findIndex((segment) => segment.value === this.value());
    return this.segments().map((_, i) => Math.max(0, 1 - Math.abs(position - i)));
  });
  /** Whether the pill is under the one chosen yet, from which it then slides to the next. */
  private placed = false;
  /** The animations moving the pill and fading the names along the panels' scrolling, if the browser runs them. */
  private animations: Animation[] = [];

  constructor() {
    afterRenderEffect(() => {
      this.value();
      this.segments();
      this.position();
      this.place();
    });
    // The one chosen in view, however it was chosen: pressed, from the keyboard, or by swiping its panel in.
    afterRenderEffect(() => {
      const value = this.value();
      this.scrollTo(this.segments().findIndex((segment) => segment.value === value));
    });
    // Again once the names' font has arrived, which can change how wide they are.
    const fonts = inject(DOCUMENT).fonts;
    inject(DestroyRef).onDestroy(() => {
      this.stopAnimations();
    });
    afterNextRender(() => {
      void fonts.ready.then(() => {
        this.place();
      });
    });
  }

  /** Moves the pill under the one chosen, fitting it: at once the first time, sliding there after that. */
  protected place(): void {
    const timeline = this.follows()?.timeline;
    if (timeline !== undefined) {
      this.animate(timeline);
      return;
    }
    const position = this.position();
    if (position !== undefined) {
      this.follow(position);
      return;
    }
    const chosen = this.buttons().find((button) => button.tabIndex === 0);
    if (chosen === undefined) {
      return;
    }
    const parts = this.pillParts();
    for (const part of parts) {
      part.style.transition = this.placed ? '' : 'none';
    }
    this.setPill(chosen.offsetLeft, chosen.offsetWidth);
    if (!this.placed) {
      // Laid out where it starts before it can slide.
      this.host.getBoundingClientRect();
      for (const part of parts) {
        part.style.transition = '';
      }
      this.placed = true;
    }
  }

  /** Puts the pill where its panels are: between the two tabs whose panels are in view, as far as they're swiped. */
  private follow(position: number): void {
    const buttons = this.buttons();
    const at = Math.min(Math.max(position, 0), buttons.length - 1);
    const [from, to] = [buttons[Math.floor(at)], buttons[Math.ceil(at)]];
    if (from === undefined || to === undefined) {
      return;
    }
    const along = at - Math.floor(at);
    const between = (a: number, b: number): number => a + (b - a) * along;
    this.setPill(
      between(from.offsetLeft, to.offsetLeft),
      between(from.offsetWidth, to.offsetWidth),
    );
  }

  /** The pill's parts: its start, its middle and its end. */
  private pillParts(): readonly [HTMLElement, HTMLElement, HTMLElement] {
    return [
      this.pillStart().nativeElement,
      this.pillMiddle().nativeElement,
      this.pillEnd().nativeElement,
    ];
  }

  /** Puts the pill's parts where they make a pill from `left`, `width` wide. */
  private setPill(left: number, width: number): void {
    const transforms = this.pillAt(left, width);
    for (const [k, part] of this.pillParts().entries()) {
      part.style.transform = transforms[k] ?? '';
    }
  }

  /**
   * The transforms of the pill's parts making a pill from `left`, `width` wide: its rounded ends at either edge, and
   * its middle stretched between them, overlapping them by a pixel so that no seam shows.
   */
  private pillAt(left: number, width: number): readonly [string, string, string] {
    const end = Math.min(this.pillStart().nativeElement.offsetWidth, width / 2);
    const middle = Math.max(0, width - 2 * end + 2) / MIDDLE;
    return [
      `translateX(${String(left)}px)`,
      `translateX(${String(left + end - 1)}px) scaleX(${String(middle)})`,
      `translateX(${String(left + width - end)}px)`,
    ];
  }

  /**
   * Has the browser move the pill and fade the names along the panels' scrolling: under each tab when its panel is in
   * view, and in between, as far as they're scrolled, as {@link follow} does. Laid out anew each time, as the tabs'
   * widths may have changed.
   */
  private animate(timeline: AnimationTimeline): void {
    this.stopAnimations();
    const buttons = this.buttons();
    const last = buttons.length - 1;
    if (last < 0) {
      return;
    }
    // Along the scrolling, from the first panel in view (0) to the last (1): a keyframe for each tab.
    const offset = (i: number): number => (last === 0 ? 0 : i / last);
    const options: KeyframeAnimationOptions = { timeline, fill: 'both', easing: 'linear' };
    const pills = buttons.map((button) => this.pillAt(button.offsetLeft, button.offsetWidth));
    const onPill = (i: number, j: number): number => Math.max(0, 1 - Math.abs(i - j));
    const fade = (
      element: Element | null,
      opacityAt: (i: number) => number,
      pseudoElement?: string,
    ): Animation[] =>
      element === null
        ? []
        : [
            element.animate(
              buttons.map((_, i) => ({ offset: offset(i), opacity: opacityAt(i) })),
              pseudoElement === undefined ? options : { ...options, pseudoElement },
            ),
          ];
    this.animations = [
      ...this.pillParts().map((part, k) =>
        part.animate(
          pills.map((transforms, i) => ({ offset: offset(i), transform: transforms[k] })),
          options,
        ),
      ),
      ...buttons.flatMap((button, j) => [
        ...fade(button.querySelector('.name'), (i) => 1 - onPill(i, j)),
        ...fade(button, (i) => onPill(i, j), '::after'),
      ]),
    ];
  }

  private stopAnimations(): void {
    for (const animation of this.animations) {
      animation.cancel();
    }
    this.animations = [];
  }

  protected choose(value: T): void {
    this.value.set(value);
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
