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
/** How long the slots take to make room for more, as the group being typed grows, in ms. */
export const GROW_DURATION = 160;
const MOVE_EASING = 'cubic-bezier(0.3, 0, 0.3, 1)';

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
 * each one's digit flies off (see {@link slotHandover}). As the group being typed grows, they make room for more the
 * same way, at once and quicker, the digits typed meanwhile filling them on their way. Not when the player prefers
 * reduced motion, nor past a row. Each move adds to any still under way, so that the slots move on from wherever they
 * are.
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
  /** How many slots there were, and for which handover, when last rendered. */
  private last: { readonly count: number; readonly handover: SlotHandover | undefined } | undefined;

  constructor() {
    // Once the slots, and those leaving, are rendered for a new handover, or for more slots.
    afterRenderEffect(() => {
      const handover = this.handover();
      const count = this.layout().count;
      untracked(() => {
        const last = this.last ?? { count, handover: undefined };
        this.last = { count, handover };
        if (handover !== last.handover) {
          this.hand(handover);
        } else if (count > last.count) {
          this.grow(last.count, count);
        }
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
    const area = this.host.getBoundingClientRect();
    const place = first.getBoundingClientRect();
    const step = this.step(first);
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
        fade === undefined ? {} : { '--appear': shown ? 1 : 0 };
      this.animations.push(
        element.animate(
          [
            { offset: 0, translate: across((from - to) * step), ...opacity(fade !== 'in') },
            {
              offset: at / total,
              translate: across((from - to) * step),
              ...opacity(fade !== 'in'),
              easing: MOVE_EASING,
            },
            { offset: 1, translate: across(0), ...opacity(fade !== 'out') },
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

  /** Makes room for more slots, from `before` to `after`, moving them all left, the new ones fading in. */
  private grow(before: number, after: number): void {
    const slots = Array.from(this.host.querySelectorAll<HTMLElement>('.slot:not(.leaving)'));
    const first = slots[0];
    if (
      first === undefined ||
      typeof first.animate !== 'function' ||
      after > SLOTS_PER_ROW ||
      prefersReducedMotion()
    ) {
      return;
    }
    const step = this.step(first);
    slotHandover(before, after).slots.forEach(({ from, to, fade }, k) => {
      const slot = slots[k];
      if (slot === undefined) {
        return;
      }
      const timing = { duration: GROW_DURATION, easing: MOVE_EASING };
      this.animations.push(
        slot.animate([{ translate: across((from - to) * step) }, { translate: across(0) }], {
          ...timing,
          composite: 'add',
        }),
      );
      if (fade === 'in') {
        this.animations.push(slot.animate([{ '--appear': 0 }, { '--appear': 1 }], timing));
      }
    });
  }

  /**
   * How far one slot is from the next, in pixels: exactly, for slots to start right where others were, and as laid
   * out, however much the slot is popping in.
   */
  private step(slot: Element): number {
    return (
      (parseFloat(getComputedStyle(slot).width) || 0) +
      (parseFloat(getComputedStyle(this.host).columnGap) || 0)
    );
  }

  private stop(): void {
    for (const animation of this.animations) {
      animation.cancel();
    }
    this.animations = [];
  }
}

/** A move across, as a `translate`, which leaves the slots' own `transform`, as they pop in, to them. */
function across(x: number): string {
  return `${String(x)}px 0px`;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
