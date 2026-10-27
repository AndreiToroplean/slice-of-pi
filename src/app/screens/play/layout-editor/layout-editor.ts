import {
  Component,
  computed,
  ElementRef,
  inject,
  model,
  OnInit,
  output,
  viewChild,
} from '@angular/core';
import { Tweaks } from '../../../developer-mode/tweaks';
import { Layout, LAYOUT } from '../../../ui/layout';
import { ButtonList } from '../../../ui/button-list';
import { Candy } from '../../../ui/candy';
import { CopyValues } from '../../tuning/copy-values';
import { dragged, LAYOUT_HANDLES, LayoutHandle, stepped, UnitSizes } from './layout-handles';

/** A handle being dragged: by which pointer, from where, and the layout and sizes it started from. */
interface Drag {
  readonly handle: LayoutHandle;
  readonly pointerId: number;
  readonly start: number;
  readonly from: Layout;
  readonly sizes: UnitSizes;
}

/** How many steps Page Up and Page Down take a handle's value, as against one for the arrow keys. */
const PAGE = 10;

/**
 * Developer mode's edit mode, over the play screen, which it covers to take every touch: a handle on each edge the
 * layout sets (see `layout-handles.ts`), dragged, or stepped with the arrow keys once picked out, as a slider. The play
 * screen shows each change at once, and it's saved, as a tweak, as each drag or key ends. Done ends it; Cancel, or
 * Escape, asks whether to cancel the changes, bringing back the layout it started with, or to go on editing. Reset
 * brings back the game's own layout, and Copy copies the layout, to go into the code. A toggle hides the handles, to
 * preview the layout as in the game, and shows them again.
 */
@Component({
  selector: 'app-layout-editor',
  imports: [ButtonList, Candy, CopyValues],
  host: { '(document:keydown.escape)': 'escape($event)' },
  template: `
    <div #probe class="probe"></div>
    @if (!previewing()) {
      @for (handle of handles; track handle.label) {
        <div
          class="line"
          [class.across]="handle.axis === 'y'"
          [class.upright]="handle.axis === 'x'"
          [style]="handle.line"
        >
          <div
            class="knob"
            role="slider"
            tabindex="0"
            [style]="handle.knob"
            [attr.aria-label]="handle.label"
            [attr.aria-orientation]="handle.axis === 'y' ? 'vertical' : 'horizontal'"
            [attr.aria-valuenow]="handle.get(layout())"
            aria-valuemin="0"
            aria-valuemax="100"
            (pointerdown)="grab(handle, $event)"
            (pointermove)="move($event)"
            (pointerup)="release($event)"
            (pointercancel)="release($event)"
            (keydown)="key(handle, $event)"
          >
            {{ handle.label }}
          </div>
        </div>
      }
    }
    <div class="actions">
      <button
        type="button"
        appCandy
        class="preview"
        title="Preview"
        [attr.aria-pressed]="previewing()"
        (click)="previewing.set(!previewing())"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <button type="button" appCandy="danger" aria-haspopup="dialog" (click)="askToCancel()">
        Cancel
      </button>
      <button type="button" appCandy="danger" [disabled]="untuned()" (click)="reset()">
        Reset
      </button>
      <app-copy-values label="Copy" [values]="{ layout: layout() }" />
      <button type="button" appCandy="primary" (click)="done.emit()">Done</button>
    </div>
    <dialog #cancelDialog class="card" closedby="any" aria-labelledby="cancel-title">
      <h2 id="cancel-title">Cancel Your Tweaks?</h2>
      <app-button-list>
        <button type="button" appCandy autofocus (click)="cancelDialog.close()">
          Continue Editing
        </button>
        <button type="button" appCandy="danger" (click)="cancel()">Yes</button>
      </app-button-list>
    </dialog>
  `,
  styleUrl: './layout-editor.css',
})
export class LayoutEditor implements OnInit {
  /** The layout edited, shown on the play screen as it changes. */
  readonly layout = model.required<Layout>();
  /** The player is done editing, keeping the changes or cancelling them. */
  readonly done = output();
  /** Whether the handles are hidden, for the play screen to show as in the game. */
  readonly previewing = model(false);

  protected readonly handles = LAYOUT_HANDLES;
  /** Whether the layout is the game's own. */
  protected readonly untuned = computed(
    () => JSON.stringify(this.layout()) === JSON.stringify(LAYOUT),
  );
  private readonly tweaks = inject(Tweaks);
  private readonly probe = viewChild.required<ElementRef<HTMLElement>>('probe');
  private readonly cancelDialog = viewChild.required<ElementRef<HTMLDialogElement>>('cancelDialog');
  private drag: Drag | undefined;
  /** The layout edit mode started with, to bring back if the changes are cancelled. */
  private original: Layout | undefined;

  ngOnInit(): void {
    this.original = this.layout();
  }

  protected grab(handle: LayoutHandle, event: PointerEvent): void {
    if (event.button !== 0 || this.drag !== undefined) {
      return;
    }
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    this.drag = {
      handle,
      pointerId: event.pointerId,
      start: handle.axis === 'y' ? event.clientY : event.clientX,
      from: this.layout(),
      sizes: this.sizes(),
    };
  }

  protected move(event: PointerEvent): void {
    const drag = this.drag;
    if (drag?.pointerId !== event.pointerId) {
      return;
    }
    const at = drag.handle.axis === 'y' ? event.clientY : event.clientX;
    this.layout.set(dragged(drag.handle, drag.from, at - drag.start, drag.sizes));
  }

  protected release(event: PointerEvent): void {
    if (this.drag?.pointerId === event.pointerId) {
      this.drag = undefined;
      this.save();
    }
  }

  protected key(handle: LayoutHandle, event: KeyboardEvent): void {
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
    this.layout.set(stepped(handle, this.layout(), steps, this.sizes()));
    this.save();
  }

  /** Asks whether to cancel the changes, as going back does; going back from the question goes on editing. */
  askToCancel(): void {
    const dialog = this.cancelDialog().nativeElement;
    if (dialog.open) {
      dialog.close();
    } else {
      dialog.showModal();
    }
  }

  /** Brings back the game's own layout, which cancelling the changes undoes, as any change. */
  protected reset(): void {
    this.layout.set(LAYOUT);
    this.save();
  }

  /** Brings back the layout edit mode started with, and is done. */
  protected cancel(): void {
    this.cancelDialog().nativeElement.close();
    if (this.original !== undefined) {
      this.layout.set(this.original);
      this.save();
    }
    this.done.emit();
  }

  /** Asks whether to cancel the changes, unless already asking: the question then closes on Escape by itself. */
  protected escape(event: Event): void {
    if (!this.cancelDialog().nativeElement.open) {
      event.preventDefault();
      this.askToCancel();
    }
  }

  private save(): void {
    void this.tweaks.setLayout(this.layout());
  }

  /** How many CSS pixels each unit of the layout is, measured from the probe, a column wide and the screen tall. */
  private sizes(): UnitSizes {
    const { width, height } = this.probe().nativeElement.getBoundingClientRect();
    return {
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
      height: height / 100 || 1,
      column: width / 100 || 1,
    };
  }
}
