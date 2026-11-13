import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
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
import { ChoiceDialog } from '../../../ui/choice-dialog';
import { Candy } from '../../../ui/candy';
import { CopyValues } from '../../tuning/copy-values';
import { LAYOUT_HANDLES } from './layout-handles';
import { lightCore, LightOf, lightKnobs, Point } from '../../../ui/handles/light-handles';
import { DISCOVER_HALO, DiscoverHalo, withHaloLight } from '../discover-halo';
import { ColorPicker } from '../../tuning/color-picker';

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

/** The Discover Halo's light, in what edit mode edits of it. */
const HALO_LIGHT: LightOf<DiscoverHalo> = {
  get: (halo) => halo.light,
  set: (halo, key, value) => withHaloLight(halo, key, value),
};

/** The Discover Halo, as a part picked out by tapping round its middle, `at`. */
function haloPart(at: Point): EditedPart {
  return {
    id: 'halo',
    name: 'Discover Halo',
    box: {
      left: `${String(at.x)}px`,
      top: `${String(at.y)}px`,
      width: '4.5rem',
      height: '4.5rem',
      translate: '-50% -50%',
    },
  };
}

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
 * the screen, the header, the tape, the slots and the keypad, and in Discover, the Discover Halo, round key 5; tapping
 * one picks it out, showing the handles on its edges (see `layout-handles.ts`), and with none picked out, as on tapping
 * elsewhere, those of the page as a whole, its margins and corner buttons. The Discover Halo, picked out, shows its
 * light's core, as a ring round it, and its reach, as a wider one, and under the buttons, knobs dragged across for the
 * other values of its light, and its color, with the game's color picker, at the bottom. Each handle is dragged, or
 * stepped with the arrow keys once picked out, as a slider. The play screen shows each change at once, and it's saved,
 * as tweaks, as each drag or key ends. Done ends it; Cancel, or Escape, asks whether to cancel the changes, bringing
 * back what it started with, or to go on editing. Reset brings back the game's own layout and Discover Halo, and Copy
 * copies both, to go into the code. A toggle hides the handles, to preview the screen as in the game, and shows them
 * again, as does tapping a part, which picks it out.
 */
@Component({
  selector: 'app-layout-editor',
  imports: [Candy, ChoiceDialog, ColorPicker, CopyValues, Handles, Parts],
  host: {
    '(document:keydown.escape)': 'escape($event)',
    '(click)': 'unpick($event)',
  },
  template: `
    <app-parts
      [parts]="parts()"
      [(picked)]="picked"
      [unseen]="previewing()"
      (revealed)="previewing.set(false)"
    />
    @if (!previewing()) {
      @let ring = reachRing();
      @if (ring !== undefined) {
        <div class="reach" aria-hidden="true" [style]="ring"></div>
      }
      <app-handles [handles]="handles()" (released)="save()" />
    }
    <div class="top">
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
        <app-copy-values label="Copy" [values]="{ layout: layout(), discoverHalo: halo() }" />
        <button type="button" appCandy="primary" (click)="done.emit()">Done</button>
      </div>
      @if (knobs().length > 0 && !previewing()) {
        <!-- The inspector of the Discover Halo: the knobs of its light, and its color. -->
        <div class="inspector">
          <app-handles [handles]="knobs()" [inline]="true" (released)="save()" />
          <button
            type="button"
            class="frosted color"
            [attr.aria-pressed]="coloring()"
            (click)="coloring.set(!coloring())"
          >
            Halo color
            <span class="swatch" [style.background]="halo().color"></span>
          </button>
        </div>
      }
    </div>
    @if (coloring() && !previewing()) {
      <!-- The halo's color, at the bottom, within the thumb's reach. -->
      <app-color-picker
        class="picker"
        name="Discover Halo"
        [color]="halo().color"
        [defaultColor]="defaultHaloColor"
        (colorChange)="setHaloColor($event)"
      />
    }
    <app-choice-dialog #cancelDialog heading="Cancel Your Tweaks?">
      <button type="button" appCandy (click)="void cancelDialog.close()">Continue Editing</button>
      <button type="button" appCandy="danger" (click)="cancel()">Yes</button>
    </app-choice-dialog>
  `,
  styleUrl: './layout-editor.css',
})
export class LayoutEditor implements OnInit {
  /** The layout edited, shown on the play screen as it changes. */
  readonly layout = model.required<Layout>();
  /** The Discover Halo edited, shown on the play screen as it changes. */
  readonly halo = model.required<DiscoverHalo>();
  /** Where the Discover Halo's middle is, in CSS pixels from the screen's top left corner, in Discover; none otherwise. */
  readonly haloAt = input<Point>();
  /** The player is done editing, keeping the changes or cancelling them. */
  readonly done = output();
  /** Whether the handles are hidden, for the play screen to show as in the game. */
  readonly previewing = model(false);

  /** The parts of the screen, with the Discover Halo, last, in Discover. */
  protected readonly parts = computed((): readonly EditedPart[] => {
    const at = this.haloAt();
    return at === undefined ? PARTS : [...PARTS, haloPart(at)];
  });
  /** The part picked out, if any. */
  protected readonly picked = signal<string | undefined>(undefined);
  private readonly bound = LAYOUT_HANDLES.map((handle) => bind(handle, this.layout));
  private readonly haloKnobs = lightKnobs(HALO_LIGHT).map((handle) => bind(handle, this.halo));
  /** Where the Discover Halo is, while it's picked out. */
  private readonly haloPicked = computed(() =>
    this.picked() === 'halo' ? this.haloAt() : undefined,
  );
  /** The handles of the part picked out, or of the page as a whole: the Discover Halo's, its light's core. */
  protected readonly handles = computed(() => {
    const at = this.haloPicked();
    if (at !== undefined) {
      return [bind(lightCore(HALO_LIGHT, at, this.halo()), this.halo)];
    }
    const labels = PARTS.find((part) => part.id === this.picked())?.handles ?? PAGE_HANDLES;
    return this.bound.filter((bound) => labels.includes(bound.handle.label));
  });
  /** The knobs of the Discover Halo's light, while it's picked out. */
  protected readonly knobs = computed(() =>
    this.haloPicked() === undefined ? [] : this.haloKnobs,
  );
  /** The ring the Discover Halo reaches to, while it's picked out. */
  protected readonly reachRing = computed(() => {
    const at = this.haloPicked();
    if (at === undefined) {
      return undefined;
    }
    const diameter = `calc(2 * ${String(this.halo().light.reach)}cqh)`;
    return {
      left: `${String(at.x)}px`,
      top: `${String(at.y)}px`,
      width: diameter,
      height: diameter,
    };
  });
  /** Whether the color picker of the Discover Halo shows: closed again as another part, or none, is picked out. */
  protected readonly coloring = linkedSignal({
    source: () => this.picked(),
    computation: () => false,
  });
  protected readonly defaultHaloColor = DISCOVER_HALO.color;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** Whether the layout and the Discover Halo are the game's own. */
  protected readonly untuned = computed(
    () =>
      JSON.stringify(this.layout()) === JSON.stringify(LAYOUT) &&
      JSON.stringify(this.halo()) === JSON.stringify(DISCOVER_HALO),
  );
  private readonly tweaks = inject(Tweaks);
  private readonly cancelDialog = viewChild.required<ChoiceDialog>('cancelDialog');
  /** What edit mode started with, to bring back if the changes are cancelled. */
  private original: { readonly layout: Layout; readonly halo: DiscoverHalo } | undefined;

  ngOnInit(): void {
    this.original = { layout: this.layout(), halo: this.halo() };
  }

  /** Colors the Discover Halo, saving each change, as the color picker moves. */
  protected setHaloColor(color: string): void {
    this.halo.update((halo) => ({ ...halo, color }));
    this.save();
  }

  /** Asks whether to cancel the changes, as going back does; going back from the question goes on editing. */
  askToCancel(): void {
    const dialog = this.cancelDialog();
    if (dialog.isOpen) {
      void dialog.close();
    } else {
      dialog.open();
    }
  }

  /** Picks no part out, on a tap on none, nor on any of the editor's buttons. */
  protected unpick(event: Event): void {
    if (event.target === this.host) {
      this.picked.set(undefined);
    }
  }

  /** Brings back the game's own layout and Discover Halo, which cancelling the changes undoes, as any change. */
  protected reset(): void {
    this.layout.set(LAYOUT);
    this.halo.set(DISCOVER_HALO);
    this.save();
  }

  /** Brings back what edit mode started with, and is done. */
  protected cancel(): void {
    void this.cancelDialog().close();
    if (this.original !== undefined) {
      this.layout.set(this.original.layout);
      this.halo.set(this.original.halo);
      this.save();
    }
    this.done.emit();
  }

  /** Asks whether to cancel the changes, unless already asking: the question then closes on Escape by itself. */
  protected escape(event: Event): void {
    if (!this.cancelDialog().isOpen) {
      event.preventDefault();
      this.askToCancel();
    }
  }

  protected save(): void {
    void this.tweaks.setLayout(this.layout());
    void this.tweaks.setDiscoverHalo(this.halo());
  }
}
