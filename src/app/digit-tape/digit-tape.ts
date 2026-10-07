import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { approach, placeRows, tapeGeometry } from './perspective';

/** Time constant of the slide towards the newest digit, in ms. */
const SLIDE_TIME_CONSTANT = 40;
/** How long after the last wheel event the view settles on a whole digit, in ms. */
const WHEEL_SETTLE_DELAY = 150;

interface Drag {
  readonly pointerId: number;
  readonly startX: number;
  readonly startHead: number;
}

/**
 * Shows the typed digits on rows receding into the distance (see `perspective.ts`), the newest digit at the center of
 * the main row. Only the digits currently visible are in the DOM.
 *
 * The player can scroll back through the digits by dragging sideways, with a wheel or trackpad, or with the arrow,
 * Home and End keys. Scrolling stops at the first and the newest digit. Typing a digit (any change to `digits`) slides
 * back to the newest one.
 */
@Component({
  selector: 'app-digit-tape',
  host: {
    '(pointerdown)': 'startDrag($event)',
    '(pointermove)': 'drag($event)',
    '(pointerup)': 'endDrag($event)',
    '(pointercancel)': 'endDrag($event)',
    '(wheel)': 'onWheel($event)',
    '(document:keydown)': 'onKeydown($event)',
  },
  template: `
    @if (geometry(); as geometry) {
      <div class="rows" aria-hidden="true" [style.font-size.px]="geometry.fontSize">
        @for (row of rows(); track row.index) {
          <div
            class="row"
            [style.top.px]="row.top"
            [style.left.px]="row.left"
            [style.width.px]="row.width"
            [style.height.px]="geometry.lineHeight"
            [style.line-height.px]="geometry.lineHeight"
            [style.transform]="row.transform"
            [style.opacity]="row.opacity"
            [style.z-index]="-row.index"
          >
            <div class="run" [style.transform]="runTransforms()[row.index]">
              @for (digit of row.digits; track digit.position) {
                <span
                  class="digit"
                  [class.newest]="digit.position === newest()"
                  [attr.data-position]="digit.position"
                  [style.width.px]="geometry.cellWidth"
                  >{{ digit.digit }}</span
                >
              }
            </div>
          </div>
        }
      </div>
    }
    <p class="visually-hidden">{{ summary() }}</p>
  `,
  styleUrl: './digit-tape.css',
})
export class DigitTape {
  /** The whole typed sequence. */
  readonly digits = input.required<string>();

  protected readonly newest = computed(() => this.digits().length - 1);

  /** Position the view is centered on. */
  private readonly target = linkedSignal(() => this.newest());
  /** Where the view currently is, moving smoothly towards `target`. */
  private readonly head = signal(-1);
  private readonly size = signal<{ width: number; height: number } | null>(null);

  protected readonly geometry = computed(() => {
    const size = this.size();
    return size === null ? null : tapeGeometry(size.width, size.height);
  });

  /** Where each row's run of digits is, changing every frame while moving. */
  private readonly placements = computed(() => {
    const geometry = this.geometry();
    return geometry === null ? [] : placeRows(geometry, this.digits().length, this.head());
  });

  /** Which digits each row holds, as `[first, last]` pairs; only changes when a digit enters or leaves a row. */
  private readonly runs = computed(
    () => this.placements().flatMap(({ first, last }) => [first, last]),
    {
      equal: (a, b) => a.length === b.length && a.every((value, i) => value === b[i]),
    },
  );

  protected readonly rows = computed(() => {
    const geometry = this.geometry();
    if (geometry === null) {
      return [];
    }
    const digits = this.digits();
    const runs = this.runs();
    return geometry.rows.map((row) => {
      const first = runs[2 * row.index] ?? 0;
      const last = runs[2 * row.index + 1] ?? -1;
      const width = row.columns * geometry.cellWidth;
      return {
        index: row.index,
        top: row.centerY - geometry.lineHeight / 2,
        left: (geometry.width - width) / 2,
        width,
        transform: `scale(${String(row.scale)})`,
        opacity: row.opacity,
        digits: Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => ({
          position: first + i,
          digit: digits.charAt(first + i),
        })),
      };
    });
  });

  /** Moves each row's run of digits to its place; the only thing that changes every frame while moving. */
  protected readonly runTransforms = computed(() => {
    const cellWidth = this.geometry()?.cellWidth ?? 0;
    return this.placements().map(
      ({ first, offset }) => `translateX(${String((first + offset) * cellWidth)}px)`,
    );
  });

  protected readonly summary = computed(() => {
    const digits = this.digits();
    return digits === ''
      ? 'No digits typed yet.'
      : `${String(digits.length)} digits typed, the last one is ${digits.slice(-1)}.`;
  });

  private frame: number | null = null;
  private lastFrameTime: number | null = null;
  private currentDrag: Drag | null = null;
  private wheelSettleTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) => {
        if (entry !== undefined) {
          this.size.set({ width: entry.contentRect.width, height: entry.contentRect.height });
        }
      });
      observer.observe(host);
      destroyRef.onDestroy(() => {
        observer.disconnect();
      });
    });

    effect(() => {
      this.target();
      untracked(() => {
        this.startSliding();
      });
    });

    destroyRef.onDestroy(() => {
      if (this.frame !== null) {
        cancelAnimationFrame(this.frame);
      }
      if (this.wheelSettleTimeout !== null) {
        clearTimeout(this.wheelSettleTimeout);
      }
    });
  }

  protected startDrag(event: PointerEvent): void {
    if (!event.isPrimary || event.button !== 0 || this.newest() < 0) {
      return;
    }
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    this.currentDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startHead: this.head(),
    };
  }

  protected drag(event: PointerEvent): void {
    const drag = this.currentDrag;
    const cellWidth = this.geometry()?.cellWidth;
    if (drag?.pointerId !== event.pointerId || cellWidth === undefined) {
      return;
    }
    // Content follows the finger: dragging right brings older digits into view.
    const position = this.clamp(drag.startHead - (event.clientX - drag.startX) / cellWidth);
    this.head.set(position);
    this.target.set(position);
  }

  protected endDrag(event: PointerEvent): void {
    if (this.currentDrag?.pointerId !== event.pointerId) {
      return;
    }
    this.currentDrag = null;
    this.target.set(Math.round(this.head()));
  }

  protected onWheel(event: WheelEvent): void {
    const cellWidth = this.geometry()?.cellWidth;
    if (cellWidth === undefined || this.newest() < 0) {
      return;
    }
    event.preventDefault();
    const delta = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const digits = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? delta / cellWidth : delta;
    this.target.update((target) => this.clamp(target + digits));
    if (this.wheelSettleTimeout !== null) {
      clearTimeout(this.wheelSettleTimeout);
    }
    this.wheelSettleTimeout = setTimeout(() => {
      this.wheelSettleTimeout = null;
      this.target.update((target) => Math.round(target));
    }, WHEEL_SETTLE_DELAY);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || this.newest() < 0) {
      return;
    }
    const target = Math.round(this.target());
    const next = {
      ArrowLeft: target - 1,
      ArrowRight: target + 1,
      Home: 0,
      End: this.newest(),
    }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      this.target.set(this.clamp(next));
    }
  }

  private clamp(position: number): number {
    return Math.min(this.newest(), Math.max(0, position));
  }

  private startSliding(): void {
    if (this.frame === null) {
      this.lastFrameTime = null;
      this.frame = requestAnimationFrame((time) => {
        this.slide(time);
      });
    }
  }

  private slide(time: number): void {
    const elapsed = this.lastFrameTime === null ? 16 : time - this.lastFrameTime;
    this.lastFrameTime = time;
    const head = approach(this.head(), this.target(), elapsed, SLIDE_TIME_CONSTANT);
    this.head.set(head);
    this.frame =
      head === this.target()
        ? null
        : requestAnimationFrame((next) => {
            this.slide(next);
          });
  }
}
