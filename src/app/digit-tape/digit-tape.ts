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
import { approach, placeDigits, tapeGeometry } from './perspective';

/** Time constant of the slide towards the newest digit, in ms. */
const SLIDE_TIME_CONSTANT = 40;

/**
 * Shows the typed digits on rows receding into the distance (see `perspective.ts`), the newest digit at the center of
 * the main row. Only the digits currently visible are in the DOM.
 */
@Component({
  selector: 'app-digit-tape',
  template: `
    @if (view(); as view) {
      <div class="rows" aria-hidden="true" [style.font-size.px]="view.geometry.fontSize">
        @for (row of view.rows; track row.index) {
          <div
            class="row"
            [style.top.px]="row.top"
            [style.width.px]="view.geometry.width"
            [style.height.px]="view.geometry.lineHeight"
            [style.line-height.px]="view.geometry.lineHeight"
            [style.transform]="row.transform"
            [style.opacity]="row.opacity"
          >
            @for (digit of row.digits; track digit.position) {
              <span
                class="digit"
                [class.newest]="digit.position === newest()"
                [style.width.px]="view.geometry.cellWidth"
                [style.transform]="digit.transform"
                >{{ digits()[digit.position] }}</span
              >
            }
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

  protected readonly view = computed(() => {
    const size = this.size();
    if (size === null) {
      return null;
    }
    const geometry = tapeGeometry(size.width, size.height);
    const placed = placeDigits(geometry, this.digits().length, this.head());
    const rows = geometry.rows
      .map((row, i) => ({
        index: row.index,
        top: row.centerY - geometry.lineHeight / 2,
        transform: `scale(${String(row.scale)})`,
        opacity: row.opacity,
        digits: (placed[i] ?? []).map(({ position, column }) => ({
          position,
          transform: `translateX(${String(column * geometry.cellWidth)}px)`,
        })),
      }))
      // Farthest rows first, so that nearer rows are drawn on top.
      .reverse();
    return { geometry, rows };
  });

  protected readonly summary = computed(() => {
    const digits = this.digits();
    return digits === ''
      ? 'No digits typed yet.'
      : `${String(digits.length)} digits typed, the last one is ${digits.slice(-1)}.`;
  });

  private frame: number | null = null;
  private lastFrameTime: number | null = null;

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
    });
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
