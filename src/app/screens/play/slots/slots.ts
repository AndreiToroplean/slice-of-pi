import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
} from '@angular/core';
import type { Box } from '../flight/flight';
import { rowStart, shownSlots, slotGap, SlotMove, slotHandover, SLOTS_SHOWN } from './slot-layout';

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
 * There is no text under the slots. Hidden from assistive technology: the typed digits say what was typed. They are one
 * row: past {@link SLOTS_SHOWN}, the first of them are off the slots' width, to the left, fading out on the way.
 *
 * Told how the slots of the group that just ended hand over to them, they move to their places from those slots', as
 * each one's digit flies off (see {@link slotHandover}). As the group being typed grows, they make room for more the
 * same way, at once and quicker, the digits typed meanwhile filling them on their way. Not when the player prefers
 * reduced motion. As the slots shrink, the last of them go the same way in reverse, fading out, as
 * they came. Each move adds to any still under way, so that the slots move on from wherever they are.
 */
@Component({
  selector: 'app-slots',
  host: {
    'aria-hidden': 'true',
    '[style.--columns]': 'count()',
    '[class.overflowing]': 'overflowing()',
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
    @for (slot of dropped(); track slot.id) {
      <span class="slot dropped" [attr.data-dropped]="slot.id"></span>
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

  protected readonly count = computed(() => shownSlots(this.digits().length, this.size()));

  /** Whether the first slots are off the slots' width, to the left. */
  protected readonly overflowing = computed(() => this.count() > SLOTS_SHOWN);

  /** Each slot's digit, or `null` while it's empty. */
  protected readonly slots = computed(() =>
    Array.from({ length: this.count() }, (_, i) => this.digits().charAt(i) || null),
  );

  /** How the slots move as they hand over, if they do. */
  private readonly moves = computed(() => {
    const handover = this.handover();
    const count = this.count();
    return handover === undefined || count === 0 || prefersReducedMotion()
      ? undefined
      : slotHandover(handover.from, count);
  });
  /** The handover whose slots leaving have left. */
  private readonly done = signal<SlotHandover | undefined>(undefined);
  /** The slots of the group that ended going, fading out, until they have. */
  protected readonly leaving = computed(() =>
    this.done() === this.handover() ? [] : (this.moves()?.leaving ?? []),
  );

  /** The slots taken away as the slots shrink, going, until they have. */
  protected readonly dropped = signal<readonly Dropped[]>([]);
  private dropping = 0;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private animations: Animation[] = [];
  /** How many slots there were, and for which handover, when last rendered. */
  private last: { readonly count: number; readonly handover: SlotHandover | undefined } | undefined;

  constructor() {
    // Once the slots, and those leaving, are rendered for a new handover, or for more slots.
    afterRenderEffect(() => {
      const handover = this.handover();
      const count = this.count();
      untracked(() => {
        const last = this.last ?? { count, handover: undefined };
        this.last = { count, handover };
        if (handover !== last.handover) {
          this.hand(handover);
        } else if (count > last.count) {
          this.grow(last.count, count);
        } else if (count < last.count) {
          this.shrink(last.count, count);
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
    this.dropped.set([]);
    const moves = this.moves();
    const slots = this.slotElements();
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
    const slots = this.slotElements();
    const first = slots[0];
    if (first === undefined || typeof first.animate !== 'function' || prefersReducedMotion()) {
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
   * Takes slots away, from `before` to `after`, as they came in reverse: the others move right, back to their places,
   * and the last go right too, fading out (see {@link drop}), as do any still going.
   */
  private shrink(before: number, after: number): void {
    const slots = this.slotElements();
    const first = slots[0];
    if (first === undefined || typeof first.animate !== 'function' || prefersReducedMotion()) {
      return;
    }
    const step = this.step(first);
    const shift = (rowStart(after) - rowStart(before)) * step;
    // Where the first slot is now, before it moves, for those taken away to go on from where they were.
    const area = this.host.getBoundingClientRect();
    const place = first.getBoundingClientRect();
    const timing: KeyframeAnimationOptions = {
      duration: GROW_DURATION,
      easing: MOVE_EASING,
      composite: 'add',
    };
    for (const slot of slots) {
      this.animations.push(
        slot.animate([{ translate: across(-shift) }, { translate: across(0) }], timing),
      );
    }
    // Those still going, out of the grid, move right as the grid does.
    for (const slot of this.host.querySelectorAll<HTMLElement>('.slot.dropped')) {
      this.animations.push(
        slot.animate([{ translate: across(0) }, { translate: across(shift) }], {
          ...timing,
          fill: 'forwards',
        }),
      );
    }
    this.dropped.update((dropped) => [
      ...dropped,
      ...Array.from({ length: before - after }, (_, i) => ({
        id: ++this.dropping,
        box: {
          left: place.left - area.left + (after + i) * step,
          top: place.top - area.top,
          width: place.width,
          height: place.height,
        },
        shift,
      })),
    ]);
    // Once rendered.
    afterNextRender(
      () => {
        this.drop(this.dropped());
      },
      { injector: this.injector },
    );
  }

  /** Sends the slots just taken away on their way, from where they were, each dropped once it has gone. */
  private drop(dropped: readonly Dropped[]): void {
    for (const slot of dropped) {
      const element = this.host.querySelector<HTMLElement>(
        `.slot.dropped[data-dropped="${String(slot.id)}"]`,
      );
      // Unless already on its way.
      const sent = element?.style.left !== '';
      if (element === null || sent || typeof element.animate !== 'function') {
        continue;
      }
      Object.assign(element.style, {
        left: `${String(slot.box.left)}px`,
        top: `${String(slot.box.top)}px`,
        width: `${String(slot.box.width)}px`,
        height: `${String(slot.box.height)}px`,
      });
      const animation = element.animate(
        [
          { translate: across(-slot.shift), '--appear': 1 },
          { translate: across(0), '--appear': 0 },
        ],
        { duration: GROW_DURATION, easing: MOVE_EASING, fill: 'forwards' },
      );
      animation.onfinish = () => {
        this.dropped.update((all) => all.filter(({ id }) => id !== slot.id));
      };
      this.animations.push(animation);
    }
  }

  /** The slots of the group being typed, leaving out those going. */
  private slotElements(): HTMLElement[] {
    return Array.from(this.host.querySelectorAll<HTMLElement>('.slot:not(.leaving, .dropped)'));
  }

  /**
   * How far one slot is from the next, in pixels: exactly, for slots to start right where others were, and as laid
   * out, however much the slot is popping in.
   */
  private step(slot: Element): number {
    const width = parseFloat(getComputedStyle(slot).width) || 0;
    return width + slotGap(parseFloat(getComputedStyle(this.host).width) || 0, width);
  }

  private stop(): void {
    for (const animation of this.animations) {
      animation.cancel();
    }
    this.animations = [];
  }
}

/** A slot taken away as the slots shrink, going: where it ends, in the area, and how far it moves right to get there. */
interface Dropped {
  readonly id: number;
  readonly box: Box;
  readonly shift: number;
}

/** A move across, as a `translate`, which leaves the slots' own `transform`, as they pop in, to them. */
function across(x: number): string {
  return `${String(x)}px 0px`;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
