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
} from '@angular/core';
import { SlotMove, slotHandover, slotLayout, SLOTS_PER_ROW } from './slot-layout';

/** How long a slot takes to move to its place as the slots hand over to the next group's, in ms. */
export const HANDOVER_DURATION = 300;
const HANDOVER_EASING = 'cubic-bezier(0.3, 0, 0.3, 1)';

/** How the slots of the group that just ended hand over to the next group's (see {@link slotHandover}). */
export interface SlotHandover {
  /** How many slots the group ended with, all filled. */
  readonly from: number;
  /** When the digit of each of its slots, by index, leaves it, flying off, in ms from now; or would, past them. */
  readonly leftAt: (index: number) => number;
}

/**
 * The typing area: the slots of the group being typed, filled with its digits so far, the next one outlined,
 * each in its place color, or marked as a mistake (red on white, outlined in red); the empty ones fade out as told.
 * There is no text under the slots. Hidden from assistive technology: the typed digits say what was typed.
 *
 * Told how the slots of the group that just ended hand over to them, they move to their places from those slots', as
 * each one's digit flies off (see {@link slotHandover}), unless the player prefers reduced motion, or either group
 * takes more than a row.
 */
@Component({
  selector: 'app-slots',
  host: {
    'aria-hidden': 'true',
    '[style.--columns]': 'layout().columns',
    '[style.--empty-opacity]': 'emptyOpacity()',
  },
  template: `
    @for (slot of slots(); track $index) {
      <span
        class="slot"
        [class.filled]="slot !== null"
        [class.next]="$index === digits().length"
        [class.wrong]="slot !== null && $index >= digits().length - wrong()"
        [style.--place-color]="colors()[$index]"
        >{{ slot }}</span
      >
    }
    @for (move of leaving(); track $index) {
      <span class="slot leaving"></span>
    }
  `,
  styleUrl: './slots.css',
})
export class Slots {
  /** The digits typed so far in the group being typed. */
  readonly digits = input.required<string>();
  /** Their place colors, in the same order. */
  readonly colors = input.required<readonly string[]>();
  /** The size of the group being typed. */
  readonly size = input.required<number>();
  /** How many of the last digits are mistakes. */
  readonly wrong = input(0);
  /** How opaque the empty slots are, from 1 down to 0, as they fade out. */
  readonly emptyOpacity = input(1);
  /** How the slots of the group that just ended hand over to these, if they do. */
  readonly handover = input<SlotHandover>();

  protected readonly layout = computed(() => slotLayout(this.digits().length, this.size()));

  /** Each slot's digit, or `null` while it's empty. */
  protected readonly slots = computed(() =>
    Array.from({ length: this.layout().count }, (_, i) => this.digits().charAt(i) || null),
  );

  /** How the slots move as they hand over, if they do. */
  private readonly moves = computed(() => {
    const handover = this.handover();
    const count = this.layout().count;
    return handover === undefined ||
      count === 0 ||
      Math.max(count, handover.from) > SLOTS_PER_ROW ||
      prefersReducedMotion()
      ? undefined
      : slotHandover(handover.from, count);
  });
  /** The handover whose slots leaving have left. */
  private readonly done = signal<SlotHandover | undefined>(undefined);
  /** The slots of the group that ended going, fading out, until they have. */
  protected readonly leaving = computed(() =>
    this.done() === this.handover() ? [] : (this.moves()?.leaving ?? []),
  );

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private animations: Animation[] = [];

  constructor() {
    // Once the slots, and those leaving, are rendered for a new handover.
    afterRenderEffect(() => {
      const handover = this.handover();
      untracked(() => {
        this.hand(handover);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.stop();
    });
  }

  /** Moves the slots, and those leaving, from the slots of the group that ended to their places. */
  private hand(handover: SlotHandover | undefined): void {
    this.stop();
    const moves = this.moves();
    const slots = Array.from(this.host.querySelectorAll<HTMLElement>('.slot:not(.leaving)'));
    const first = slots[0];
    if (handover === undefined || moves === undefined || first === undefined) {
      return;
    }
    // Measured exactly, as laid out, for the slots to start right where those they take over were.
    const area = this.host.getBoundingClientRect();
    const place = first.getBoundingClientRect();
    const step = place.width + (parseFloat(getComputedStyle(this.host).columnGap) || 0);
    const leaving = Array.from(this.host.querySelectorAll<HTMLElement>('.slot.leaving'));
    // Where each slot leaving ends, from the first slot's place, which it moves to.
    leaving.forEach((ghost, j) => {
      Object.assign(ghost.style, {
        left: `${String(place.left - area.left + (moves.leaving[j]?.to ?? 0) * step)}px`,
        top: `${String(place.top - area.top)}px`,
        width: `${String(place.width)}px`,
        height: `${String(place.height)}px`,
      });
    });
    const move = (element: HTMLElement | undefined, { from, to, after, fade }: SlotMove): void => {
      if (element === undefined || typeof element.animate !== 'function') {
        return;
      }
      const at = Math.max(0, handover.leftAt(after));
      const total = at + HANDOVER_DURATION;
      const opacity = (shown: boolean): Keyframe =>
        fade === undefined ? {} : { opacity: shown ? 1 : 0 };
      this.animations.push(
        element.animate(
          [
            {
              offset: 0,
              transform: `translateX(${String((from - to) * step)}px)`,
              ...opacity(fade !== 'in'),
            },
            {
              offset: at / total,
              transform: `translateX(${String((from - to) * step)}px)`,
              ...opacity(fade !== 'in'),
              easing: HANDOVER_EASING,
            },
            { offset: 1, transform: 'none', ...opacity(fade !== 'out') },
          ],
          { duration: total, fill: fade === 'out' ? 'forwards' : 'none' },
        ),
      );
    };
    moves.slots.forEach((slot, k) => {
      move(slots[k], slot);
    });
    moves.leaving.forEach((ghost, j) => {
      move(leaving[j], ghost);
    });
    const last = this.animations.at(-1);
    if (leaving.length > 0 && last !== undefined) {
      last.onfinish = () => {
        this.done.set(handover);
      };
    }
  }

  private stop(): void {
    for (const animation of this.animations) {
      animation.cancel();
    }
    this.animations = [];
  }
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
