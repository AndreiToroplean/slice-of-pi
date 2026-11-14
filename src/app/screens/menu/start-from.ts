import {
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Checkpoint } from '../../player-data/checkpoint';
import { GameMode } from '../../game/modes/game-mode';
import { Candy, CandyLook } from '../../ui/candy';
import { CandyGroup } from '../../ui/candy-group';
import { breatheEvenly } from '../../ui/breath';
import { Spinner } from '../../ui/spinner';

/** How far a nudge shows the place in, in CSS pixels, before it goes back. */
export const NUDGE = 28;
/** How long a swipe waits, once it has stopped, to settle, where the browser doesn't say it has: in ms. */
const SETTLE = 150;
/** How long a touch on it waits to tell a swipe from a press before it shows the press, in ms (see `Candy`). */
export const SWIPE_WAIT = 100;

/**
 * A button starting a game mode, from the start of π, which once the player has unlocked a checkpoint, is one candy
 * button of two parts (see `CandyGroup`): what it starts, then its place, folded, but for a small arrow at its start,
 * pointing left. Pressing the place, or swiping the button left, unfolds it, for the game mode to start from the place
 * picked for it instead, "Discovery from 40", kept for the next visits, for each game mode: the place comes in from the
 * right over the end of what it starts, as the finger goes, as the browser scrolls it, snapping all the way in or out,
 * and only what's within the button's outline shows. Its arrow turns as it comes, to point right once it's in. There,
 * the place shows a small "from" above it, which the player drags up or down, or across, to pick another checkpoint
 * unlocked, ten places a step (see `Spinner`); pressing it rather than dragging it, or swiping what it starts right,
 * folds it back, to start from the start of π again. Only what it starts starts the game. Pressing that presses all of
 * it, both parts showing the one press from the start of a touch to its end, and for as long as a press shows at least,
 * once it's clear it's no swipe; pressing the place shows none, as it folds or unfolds. Told to, while folded, it
 * nudges the place in a little and back, for the player to see it's there.
 */
@Component({
  selector: 'app-start-from',
  imports: [Candy, CandyGroup, RouterLink, Spinner],
  host: { '[class.unlocked]': 'unlocked()' },
  template: `
    @if (unlocked()) {
      <!-- Both parts show one and the same press, never the browser's own on what it starts, which lets go on its own. -->
      <!-- The button's outline, holding still around what scrolls, which breathes and shines as one button. -->
      <div #outline class="outline">
        <div
          #swipe
          class="swipe"
          [class.nudging]="nudging()"
          [style.--shown.px]="shown()"
          [style.--unfolded]="unfolded()"
          (scroll)="follow()"
          (scrollend)="settle()"
          (pointerdown)="nudged.set(undefined)"
        >
          <app-candy-group>
            <a
              #link="appCandy"
              [appCandy]="look()"
              class="name"
              [routerLink]="path()"
              [queryParams]="from() ? { from: place() } : {}"
              [pressed]="link.held()"
              [swipeWait]="swipeWait"
              data-vibration="play"
              >{{ name() }}<span class="visually-hidden">{{ from() ? ' from' : '' }}</span></a
            >
            <!--
              Pressed anywhere, its arrow or its spinner, but for a drag of it, which says it isn't a press (see \`Spinner\`),
              it folds or unfolds.
            -->
            <div [appCandy]="look()" class="place" [pressed]="link.held()">
              <span class="parts">
                <button
                  type="button"
                  class="arrow"
                  [title]="name() + ' From'"
                  [attr.aria-expanded]="from()"
                  (click)="toggle()"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 7-5 5 5 5" /></svg>
                </button>
                <div class="picker" [attr.inert]="from() ? null : ''">
                  <span class="from" aria-hidden="true">from</span>
                  <app-spinner
                    [label]="name() + ' from'"
                    [min]="0"
                    [max]="checkpoint.farthest()"
                    [step]="10"
                    [value]="place()"
                    data-vibration="play"
                    (valueChange)="void checkpoint.pick(mode(), $event)"
                    (click)="$event.defaultPrevented || toggle()"
                    (keydown.enter)="toggle()"
                  />
                </div>
              </span>
            </div>
          </app-candy-group>
        </div>
      </div>
    } @else {
      <a [appCandy]="look()" [routerLink]="path()" data-vibration="play">{{ name() }}</a>
    }
  `,
  styles: `
    :host {
      display: block;
      /* The room around the place, which the spinner takes, so that a touch anywhere on that part drags it. */
      --place-padding-block: var(--candy-padding-block, 0.75rem);
      /* The height of the "from" above the place, which shifts the place down by half of it, the button keeping its height. */
      --from-height: 0.75rem;
      /* How wide the arrow is: its room, either side, around its icon. */
      --arrow-width: calc(2 * 0.5rem + 1.25rem);
      /* How thick a candy button's edge is (see \`candy.css\`). */
      --edge: 0.3125rem;
    }

    /*
     * Its shade, cast by what shows of it, its parts casting none of their own, which would show past its outline: as a
     * candy button's (see \`candy.css\`).
     */
    :host(.unlocked) {
      filter: drop-shadow(0 0.5rem 0.625rem rgb(40 20 60 / 18%));
    }

    /*
     * The button as a whole, which breathes as a candy group does (see \`CandyGroup\`), rather than its parts, which the
     * swipe would cut, and shines across all of it, once, rather than part by part, which would show apart as the place
     * slides over what it starts.
     */
    .outline {
      position: relative;
      scale: calc(1 + var(--candy-breath) / 3 * var(--breath, 3) * var(--candy-breath-step, 0));
    }

    .outline:has(:focus-visible):not(:has(.pressed)) {
      animation: breathe 0.6s var(--ease) infinite alternate;
    }

    /* Without motion, it stays grown. */
    @media (prefers-reduced-motion: reduce) {
      .outline:has(:focus-visible) {
        --candy-breath: 2;
      }
    }

    /*
     * The shine, over its face, but its edge, out of sight until it's picked out (see \`--candy-shine\` in \`styles.css\`):
     * laid over it, it lights the face up, but not what it says, which would fade.
     */
    .outline::after {
      content: '';
      position: absolute;
      inset: 0 0 var(--edge);
      border-radius: var(--radius-key);
      background: var(--candy-shine);
      mix-blend-mode: overlay;
      pointer-events: none;
    }

    .outline:has(:focus-visible):not(:has(.pressed))::after {
      animation: shine 2.4s ease-in-out infinite;
    }

    /* Its parts don't breathe nor shine on their own. */
    .outline .swipe app-candy-group > .candy {
      animation: none;
    }

    /*
     * What the finger swipes, as the browser scrolls it: what it starts at the start, the place at the end, snapping to
     * either. It's the button's outline, its edge with it, which holds still as what's within scrolls, showing only that.
     */
    .swipe {
      container-type: inline-size;
      overflow-x: auto;
      overflow-y: hidden;
      overscroll-behavior-x: contain;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
      padding-bottom: var(--edge);
      margin-bottom: calc(-1 * var(--edge));
      border-radius: var(--radius-key);
    }

    .swipe::-webkit-scrollbar {
      display: none;
    }

    /* Nudged, it goes where it's sent, rather than snapping. */
    .swipe.nudging {
      scroll-snap-type: none;
    }

    @media (prefers-reduced-motion: no-preference) {
      .swipe {
        scroll-behavior: smooth;
      }
    }

    /*
     * What it starts as wide as the swipe, but for the arrow, the place past it, all of it holding what it starts in
     * place as it scrolls. The outline breathes and shines for it.
     */
    app-candy-group {
      container-type: normal;
      width: max-content;
      /* Its start, rather than what it starts, which is held in place, and would snap wherever it is. */
      scroll-snap-align: start;
      grid-template-columns: calc(100cqi - var(--arrow-width));
      scale: none;
    }

    app-candy-group > .candy {
      --candy-drop: 0 0 transparent;
    }

    /*
     * On one line, staying where it is as the place comes in over its end, what it says in the middle of what shows of
     * it.
     */
    .name {
      position: sticky;
      inset-inline-start: 0;
      padding-inline-end: calc(var(--candy-padding-inline, 0.75rem) + var(--shown));
      white-space: nowrap;
    }

    .place {
      scroll-snap-align: end;
      --candy-padding-block: 0px;
      --candy-padding-inline: 0px;
      font-family: var(--font-digits);
    }

    /* The arrow, then the spinner, side by side. */
    .parts {
      display: flex;
    }

    /* Bare, in the place, which is the button, turning as the place comes in, from pointing left to pointing right. */
    .arrow {
      display: grid;
      place-items: center;
      width: var(--arrow-width);
      padding: 0;
      border: none;
      background: none;
      color: inherit;
      cursor: pointer;
      pointer-events: auto;
      -webkit-tap-highlight-color: transparent;
    }

    .arrow:focus-visible {
      outline: none;
    }

    .arrow svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      rotate: calc(var(--unfolded) * 180deg);
    }

    .picker {
      position: relative;
    }

    /* The spinner takes the touches its button's content would let through, and picked out, the button shows it. */
    app-spinner {
      padding: calc(var(--place-padding-block) + var(--from-height) / 2) 0.625rem
        calc(var(--place-padding-block) - var(--from-height) / 2) 0;
      pointer-events: auto;
      text-align: start;
    }

    /* Over the spinner, which still takes the touches, lined up with the place. */
    .from {
      position: absolute;
      inset-inline-start: 0;
      top: calc(var(--place-padding-block) - var(--from-height) / 2);
      font-family: var(--font-ui);
      font-size: 0.625rem;
      line-height: var(--from-height);
      pointer-events: none;
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
  /** Whether to nudge the place in and back, while it starts from the start of π, for the player to see it's there. */
  readonly nudge = input(false);

  protected readonly checkpoint = inject(Checkpoint);
  /** Whether it can start from a place: once the player has unlocked a checkpoint. */
  protected readonly unlocked = computed(() => this.checkpoint.farthest() > 0);
  /** Whether it starts from its place. */
  protected readonly from = computed(() => this.checkpoint.startsFrom(this.mode()));
  /** How far the place has come in, in CSS pixels. */
  protected readonly shown = signal(0);
  /** How far the place has come in, from 0, folded, to 1, all the way in. */
  protected readonly unfolded = signal(0);
  /** How far along a nudge it is, if it's being nudged: going in, or back. */
  protected readonly nudged = signal<'in' | 'back' | undefined>(undefined);
  /** Whether it's being nudged. */
  protected readonly nudging = computed(() => this.nudged() !== undefined);
  protected readonly swipeWait = SWIPE_WAIT;
  private readonly swipe = viewChild<ElementRef<HTMLElement>>('swipe');
  private readonly outline = viewChild<ElementRef<HTMLElement>>('outline');
  private settling: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // The outline breathes evenly, by its own width.
    const destroyRef = inject(DestroyRef);
    afterRenderEffect(() => {
      const outline = this.outline()?.nativeElement;
      if (outline !== undefined) {
        breatheEvenly(outline, destroyRef);
      }
    });
    // Where it starts from, the place in or out, at once, once it shows, and whenever that changes elsewhere.
    afterRenderEffect(() => {
      const swipe = this.swipe()?.nativeElement;
      const from = this.from();
      if (swipe !== undefined) {
        untracked(() => {
          // At once, rather than as smoothly as the swipe goes.
          swipe.style.scrollBehavior = 'auto';
          swipe.scrollLeft = from ? swipe.scrollWidth : 0;
          swipe.style.scrollBehavior = '';
          this.follow();
        });
      }
    });
    afterRenderEffect(() => {
      const swipe = this.swipe()?.nativeElement;
      if (swipe !== undefined && this.nudge() && !untracked(this.from)) {
        untracked(() => {
          this.nudgeIn(swipe);
        });
      }
    });
  }

  protected place(): number {
    return this.checkpoint.place(this.mode());
  }

  /** Folds the place, or unfolds it, as far as it has come in, as a swipe would. */
  protected toggle(): void {
    const swipe = this.swipe()?.nativeElement;
    if (swipe !== undefined) {
      this.nudged.set(undefined);
      swipe.scrollLeft = this.unfolded() < 0.5 ? swipe.scrollWidth : 0;
    }
  }

  /** Follows the swipe, the place coming in as far as it's scrolled. */
  protected follow(): void {
    const swipe = this.swipe()?.nativeElement;
    const shown = Math.max(0, swipe?.scrollLeft ?? 0);
    const span = swipe === undefined ? 0 : swipe.scrollWidth - swipe.clientWidth;
    this.shown.set(shown);
    this.unfolded.set(span > 0 ? Math.min(1, shown / span) : 0);
    // Where the browser doesn't say once it has stopped.
    if (swipe !== undefined && !('onscrollend' in swipe)) {
      clearTimeout(this.settling);
      this.settling = setTimeout(() => {
        this.settle();
      }, SETTLE);
    }
  }

  /**
   * Once the swipe has stopped: starts from its place, or from the start of π, as far as the place has come in; or
   * once nudged, sends it back.
   */
  protected settle(): void {
    const swipe = this.swipe()?.nativeElement;
    if (swipe === undefined) {
      return;
    }
    const nudged = this.nudged();
    if (nudged !== undefined) {
      if (nudged === 'in' && swipe.scrollLeft > 0) {
        this.nudged.set('back');
        swipe.scrollLeft = 0;
      } else if (nudged === 'back' && swipe.scrollLeft === 0) {
        this.nudged.set(undefined);
      }
      return;
    }
    const from = swipe.scrollLeft * 2 > swipe.scrollWidth - swipe.clientWidth;
    if (from !== this.from()) {
      void this.checkpoint.switchTo(this.mode(), from);
    }
  }

  /** Shows the place in a little, then back, unless the player would rather the screen didn't move. */
  private nudgeIn(swipe: HTMLElement): void {
    if (
      typeof matchMedia === 'undefined' ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    this.nudged.set('in');
    // Without snapping, at once, rather than once the class is bound.
    swipe.classList.add('nudging');
    swipe.scrollLeft = NUDGE;
  }
}
