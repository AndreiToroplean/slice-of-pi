import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { BoundHandle, UnitSizes } from './handle';

/** How many steps Page Up and Page Down take a handle's value, as against one for the arrow keys. */
const PAGE = 10;

/** A handle being dragged: which, by which pointer, and from where. */
interface Drag {
  readonly bound: BoundHandle;
  readonly pointerId: number;
  readonly start: number;
  readonly sizes: UnitSizes;
}

/**
 * An editor's handles (see `handle.ts`): each a knob, along its line or ring, or alone, in a row, with `inline`. Each
 * knob is a slider: dragged, or stepped with the arrow keys and Page Up and Down once picked out. `released` tells when
 * a drag or a key ends, for the editor to save the change. Lengths are measured from a probe, as wide as the column and
 * as tall as `--handles-height`, the whole of what the handles cover unless set.
 */
@Component({
  selector: 'app-handles',
  imports: [NgTemplateOutlet],
  host: { '[class.inline]': 'inline()' },
  template: `
    <div #probe class="probe"></div>
    @for (bound of handles(); track bound.handle.label) {
      @let handle = bound.handle;
      @if (inline() || handle.line === undefined) {
        <ng-container *ngTemplateOutlet="knob; context: { $implicit: bound }"></ng-container>
      } @else {
        <div
          class="line"
          [class.across]="handle.axis === 'y' && !handle.ring"
          [class.upright]="handle.axis === 'x' && !handle.ring"
          [class.ring]="handle.ring"
          [style]="handle.line"
        >
          <ng-container *ngTemplateOutlet="knob; context: { $implicit: bound }"></ng-container>
        </div>
      }
    }
    <ng-template #knob let-bound>
      <div
        class="knob"
        role="slider"
        tabindex="0"
        [style]="bound.handle.knob"
        [attr.aria-label]="bound.handle.label"
        [attr.aria-orientation]="bound.handle.axis === 'y' ? 'vertical' : 'horizontal'"
        [attr.aria-valuenow]="bound.value()"
        (pointerdown)="grab(bound, $event)"
        (pointermove)="move($event)"
        (pointerup)="release($event)"
        (pointercancel)="release($event)"
        (keydown)="key(bound, $event)"
      >
        {{ bound.handle.label }}
        @if (inline()) {
          <span class="value">{{ bound.value() }}</span>
        }
      </div>
    </ng-template>
  `,
  styleUrl: './handles.css',
})
export class Handles {
  readonly handles = input.required<readonly BoundHandle[]>();
  /** Whether the knobs stand alone, in a row, rather than each on its line. */
  readonly inline = input(false);
  /** A drag or a key moving a handle has ended. */
  readonly released = output();

  private readonly probe = viewChild.required<ElementRef<HTMLElement>>('probe');
  private drag: Drag | undefined;

  protected grab(bound: BoundHandle, event: PointerEvent): void {
    if (event.button !== 0 || this.drag !== undefined) {
      return;
    }
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    bound.grab();
    this.drag = {
      bound,
      pointerId: event.pointerId,
      start: bound.handle.axis === 'y' ? event.clientY : event.clientX,
      sizes: this.sizes(),
    };
  }

  protected move(event: PointerEvent): void {
    const drag = this.drag;
    if (drag?.pointerId !== event.pointerId) {
      return;
    }
    const at = drag.bound.handle.axis === 'y' ? event.clientY : event.clientX;
    drag.bound.drag(at - drag.start, drag.sizes);
  }

  protected release(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) {
      this.drag = undefined;
      this.released.emit();
    }
  }

  protected key(bound: BoundHandle, event: KeyboardEvent): void {
    const steps = {
      ArrowUp: 1,
      ArrowRight: 1,
      ArrowDown: -1,
      ArrowLeft: -1,
      PageUp: PAGE,
      PageDown: -PAGE,
    }[event.key];
    if (steps === undefined) {
      return;
    }
    event.preventDefault();
    bound.step(steps, this.sizes());
    this.released.emit();
  }

  /** How many CSS pixels each unit is, measured from the probe, a column wide and `--handles-height` tall. */
  private sizes(): UnitSizes {
    const { width, height } = this.probe().nativeElement.getBoundingClientRect();
    return {
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
      height: height / 100 || 1,
      column: width / 100 || 1,
    };
  }
}
