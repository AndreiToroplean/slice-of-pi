import {
  Component,
  computed,
  ElementRef,
  inject,
  model,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { bind } from '../../../ui/handles/handle';
import { Handles } from '../../../ui/handles/handles';
import { EditedPart, Parts } from '../../../ui/handles/parts';
import { Tweaks } from '../../../developer-mode/tweaks';
import { Layout, LAYOUT } from '../../../ui/layout';
import { ButtonList } from '../../../ui/button-list';
import { Candy } from '../../../ui/candy';
import { CopyValues } from '../../tuning/copy-values';
import { LAYOUT_HANDLES } from './layout-handles';

/** Across the column, within the side margins, as the play screen's parts are. */
const ACROSS = {
  left: 'calc(var(--margin) + var(--margin-side))',
  right: 'calc(var(--margin) + var(--margin-side))',
};

/** Each part of the play screen, its box, from the top, and the labels of its handles. */
const PARTS: readonly (EditedPart & { readonly handles: readonly string[] })[] = [
  {
    id: 'header',
    name: 'Header',
    box: { ...ACROSS, top: 'var(--margin-top)', height: 'var(--header-height)' },
    handles: ['Header'],
  },
  {
    id: 'tape',
    name: 'Tape',
    box: {
      ...ACROSS,
      bottom: 'calc(var(--floor) + var(--tape-bottom))',
      height: 'calc(var(--tape-top) - var(--tape-bottom))',
    },
    handles: ['Tape top', 'Tiles', 'Tape bottom'],
  },
  {
    id: 'slots',
    name: 'Slots',
    box: {
      ...ACROSS,
      bottom: 'calc(var(--floor) + var(--slots-bottom))',
      height: 'calc(var(--slots-top) - var(--slots-bottom))',
    },
    handles: ['Slots top', 'Slot radius', 'Slot width', 'Slots bottom', 'Slot depth'],
  },
  {
    id: 'keypad',
    name: 'Keypad',
    box: {
      ...ACROSS,
      bottom: 'calc(var(--floor) + var(--margin-bottom))',
      height: 'calc(var(--keypad-top) - var(--margin-bottom))',
    },
    handles: ['Touch top', 'Keypad top', 'Key width', 'Key height', 'Key radius', 'Key depth'],
  },
];

/** The handles of the page as a whole, shown with no part picked out: its margins and corner buttons. */
const PAGE_HANDLES = [
  'Top margin',
  'Corner size',
  'Corner radius',
  'Side margins',
  'Bottom margin',
];

/**
 * Developer mode's edit mode, over the play screen, which it covers to take every touch. A dashed box shows each part of
 * the screen, the header, the tape, the slots and the keypad; tapping one picks it out, showing the handles on its
 * edges (see `layout-handles.ts`), and with none picked out, as on tapping elsewhere, those of the page as a whole, its
 * margins and corner buttons. Each handle is dragged, or stepped with the arrow keys once picked out, as a slider. The play
 * screen shows each change at once, and it's saved, as a tweak, as each drag or key ends. Done ends it; Cancel, or
 * Escape, asks whether to cancel the changes, bringing back the layout it started with, or to go on editing. Reset
 * brings back the game's own layout, and Copy copies the layout, to go into the code. A toggle hides the handles, to
 * preview the layout as in the game, and shows them again, as does tapping a part, which picks it out.
 */
@Component({
  selector: 'app-layout-editor',
  imports: [ButtonList, Candy, CopyValues, Handles, Parts],
  host: {
    '(document:keydown.escape)': 'escape($event)',
    '(click)': 'unpick($event)',
  },
  template: `
    <app-parts
      [parts]="parts"
      [(picked)]="picked"
      [unseen]="previewing()"
      (revealed)="previewing.set(false)"
    />
    @if (!previewing()) {
      <app-handles [handles]="handles()" (released)="save()" />
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

  protected readonly parts = PARTS;
  /** The part picked out, if any. */
  protected readonly picked = signal<string | undefined>(undefined);
  private readonly bound = LAYOUT_HANDLES.map((handle) => bind(handle, this.layout));
  /** The handles of the part picked out, or of the page as a whole. */
  protected readonly handles = computed(() => {
    const labels = PARTS.find((part) => part.id === this.picked())?.handles ?? PAGE_HANDLES;
    return this.bound.filter((bound) => labels.includes(bound.handle.label));
  });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** Whether the layout is the game's own. */
  protected readonly untuned = computed(
    () => JSON.stringify(this.layout()) === JSON.stringify(LAYOUT),
  );
  private readonly tweaks = inject(Tweaks);
  private readonly cancelDialog = viewChild.required<ElementRef<HTMLDialogElement>>('cancelDialog');
  /** The layout edit mode started with, to bring back if the changes are cancelled. */
  private original: Layout | undefined;

  ngOnInit(): void {
    this.original = this.layout();
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

  /** Picks no part out, on a tap on none, nor on any of the editor's buttons. */
  protected unpick(event: Event): void {
    if (event.target === this.host) {
      this.picked.set(undefined);
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

  protected save(): void {
    void this.tweaks.setLayout(this.layout());
  }
}
