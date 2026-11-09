import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  OnInit,
  output,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { Tweaks } from '../../developer-mode/tweaks';
import { ChoiceDialog } from '../../ui/choice-dialog';
import { Candy } from '../../ui/candy';
import { bind, UnitSizes } from '../../ui/handles/handle';
import { Handles } from '../../ui/handles/handles';
import { Parts } from '../../ui/handles/parts';
import { Layout, LAYOUT } from '../../ui/layout';
import { Light } from '../../ui/light-layer';
import { LAYOUT_HANDLES } from '../play/layout-editor/layout-handles';
import { ColorPicker } from '../tuning/color-picker';
import { CopyValues } from '../tuning/copy-values';
import {
  coreHandle,
  lightKnobs,
  MenuPart,
  PART_BOXES,
  PART_HANDLES,
  PART_LIGHTS,
  PART_NAMES,
  Point,
} from './menu-handles';
import { LightLayer, MENU_LOOK, MenuLook, withIconLight } from './menu-look';

/** The handles of edit mode that set the margins round every screen, and its corner buttons, which the menu has too. */
const MARGIN_HANDLES = LAYOUT_HANDLES.filter((handle) =>
  ['Top margin', 'Corner size', 'Corner radius', 'Side margins', 'Bottom margin'].includes(
    handle.label,
  ),
);

/** The menu's parts, from the top. */
const PARTS: readonly MenuPart[] = ['icon', 'slice', 'pi', 'buttons'];

/**
 * The layout with the margins and corner buttons of the game's own, the rest as it is: the bottom margin set as its
 * handle sets it, given the screen's sizes, so that the play screen's keypad, which stands on it, follows it back.
 */
function untunedMargins(layout: Layout, sizes?: UnitSizes): Layout {
  const bottom = MARGIN_HANDLES.find((handle) => handle.label === 'Bottom margin');
  const standing =
    bottom === undefined || sizes === undefined
      ? layout
      : bottom.set(layout, LAYOUT.margins.bottom, sizes);
  return { ...standing, margins: LAYOUT.margins, corner: LAYOUT.corner };
}

/**
 * Developer mode's editor of the main menu, over it, as edit mode is over the play screen. A dashed box shows each part
 * of the menu; tapping one picks it out, showing its handles. The icon and the name's lines have their height, carrying
 * along those above them, as they stand on one another, "Pi" the whole group, and their size, as they stay centered
 * across; the buttons, where they stand, their size and the gap between them. A part that gives off light has its core,
 * as a ring round it, its reach, as a wider one, and in a row at the top, knobs dragged across for the other values of
 * its light; the icon, the height of its light, and its color, with the game's color picker, at the bottom. With no
 * part picked out, as on tapping elsewhere, the handles are those of the margins and corner buttons, which every screen
 * shares. The menu shows each change at once, and it's saved, as tweaks, as each drag or key ends. Done ends it;
 * Cancel, or Escape, asks whether to cancel the changes, bringing back what it started with, or to go on editing. Reset
 * brings back the menu's own look and the game's own margins, and Copy copies both, to go into the code. A toggle hides
 * the handles, to preview the menu as in the game, and shows them again, as does tapping a part, which picks it out.
 */
@Component({
  selector: 'app-menu-editor',
  imports: [Candy, ChoiceDialog, ColorPicker, CopyValues, Handles, Parts],
  host: {
    '(document:keydown.escape)': 'escape($event)',
    '(click)': 'unpick($event)',
  },
  template: `
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
        <app-copy-values label="Copy" [values]="{ layout: layout(), menu: look() }" />
        <button type="button" appCandy="primary" (click)="done.emit()">Done</button>
      </div>
      @if (!previewing()) {
        <!-- The inspector: what's picked out, and the knobs of its light. -->
        <div class="inspector">
          <p class="picked">{{ pickedName() }}</p>
          @if (knobs().length > 0) {
            <app-handles [handles]="knobs()" [inline]="true" (released)="save()" />
          }
          @if (picked() === 'icon') {
            <button
              type="button"
              class="frosted color"
              [attr.aria-pressed]="coloring()"
              (click)="coloring.set(!coloring())"
            >
              Light color
              <span class="swatch" [style.background]="look().iconLight.color"></span>
            </button>
          }
        </div>
      }
    </div>
    @if (coloring() && !previewing()) {
      <!-- The color of the icon's light, at the bottom, within the thumb's reach. -->
      <app-color-picker
        class="picker"
        name="Icon light"
        [color]="look().iconLight.color"
        [defaultColor]="defaultIconLight"
        (colorChange)="setIconLightColor($event)"
      />
    }
    <app-parts
      [parts]="parts"
      [(picked)]="picked"
      [unseen]="previewing()"
      (revealed)="previewing.set(false)"
    />
    @if (!previewing()) {
      @let ring = reachRing();
      @if (ring !== undefined) {
        <div class="reach" aria-hidden="true" [style]="ring"></div>
      }
      <!-- Heights in hundredths of the menu's free space, as the title and the buttons stand in it. -->
      <app-handles #onMenu class="on-menu" [handles]="handles()" (released)="save()" />
    }
    <app-choice-dialog #cancelDialog heading="Cancel Your Tweaks?">
      <button type="button" appCandy (click)="void cancelDialog.close()">Continue Editing</button>
      <button type="button" appCandy="danger" (click)="cancel()">Yes</button>
    </app-choice-dialog>
  `,
  styleUrl: './menu-editor.css',
})
export class MenuEditor implements OnInit {
  /** The look edited, shown on the menu as it changes. */
  readonly look = model.required<MenuLook>();
  /** The layout of every screen, edited for its margins and corner buttons, shown on the menu as it changes. */
  readonly layout = model.required<Layout>();
  /** Where the lights of each layer are, for the rings of the light of the part picked out. */
  readonly lights = input.required<Readonly<Record<LightLayer, readonly Light[]>>>();
  /** The player is done editing, keeping the changes or cancelling them. */
  readonly done = output();
  /** Whether the handles are hidden, for the menu to show as in the game. */
  readonly previewing = model(false);

  protected readonly parts = PART_BOXES;
  /** The part picked out, if any. */
  protected readonly picked = signal<string | undefined>(undefined);
  protected readonly pickedName = computed(() => {
    const part = this.part();
    return part === undefined ? 'Margins: tap a part to edit it' : PART_NAMES[part];
  });

  private readonly marginHandles = MARGIN_HANDLES.map((handle) => bind(handle, this.layout));
  private readonly partHandles = Object.fromEntries(
    PARTS.map((part) => [part, PART_HANDLES[part].map((handle) => bind(handle, this.look))]),
  ) as Record<MenuPart, ReturnType<typeof bind>[]>;
  private readonly lightHandles = Object.fromEntries(
    (['icon', 'slice', 'pi'] as const).map((layer) => [
      layer,
      lightKnobs(layer).map((handle) => bind(handle, this.look)),
    ]),
  ) as Record<LightLayer, ReturnType<typeof bind>[]>;

  /** The part picked out, as one of the menu's. */
  private readonly part = computed(() => PART_BOXES.find((each) => each.id === this.picked())?.id);
  /** Whether the color picker of the icon's light shows: closed again as another part, or none, is picked out. */
  protected readonly coloring = linkedSignal({
    source: () => this.part(),
    computation: () => false,
  });
  /** The layer of light of the part picked out, if it gives off light. */
  private readonly layer = computed(() => {
    const part = this.part();
    return part === undefined ? undefined : PART_LIGHTS[part];
  });
  /** Where the lights of that layer are, on average. */
  private readonly center = computed((): Point | undefined => {
    const layer = this.layer();
    const lights = layer === undefined ? [] : this.lights()[layer];
    return lights.length === 0
      ? undefined
      : {
          x: lights.reduce((sum, light) => sum + light.x, 0) / lights.length,
          y: lights.reduce((sum, light) => sum + light.y, 0) / lights.length,
        };
  });
  /** The handles on the menu: the margins', or those of the part picked out, with its light's core. */
  protected readonly handles = computed(() => {
    const part = this.part();
    if (part === undefined) {
      return this.marginHandles;
    }
    const layer = this.layer();
    const center = this.center();
    return layer === undefined || center === undefined
      ? this.partHandles[part]
      : [...this.partHandles[part], bind(coreHandle(layer, center, this.look()), this.look)];
  });
  /** The knobs of the light of the part picked out, if it gives off light. */
  protected readonly knobs = computed(() => {
    const layer = this.layer();
    return layer === undefined ? [] : this.lightHandles[layer];
  });
  /** The ring its light reaches to, round where its lights are. */
  protected readonly reachRing = computed(() => {
    const layer = this.layer();
    const center = this.center();
    if (layer === undefined || center === undefined) {
      return undefined;
    }
    const diameter = `calc(2 * ${String(this.look().light[layer].reach)}cqh)`;
    return {
      left: `${String(center.x)}px`,
      top: `${String(center.y)}px`,
      width: diameter,
      height: diameter,
    };
  });

  protected readonly defaultIconLight = MENU_LOOK.iconLight.color;
  /** Whether the look is the menu's own, and the margins the game's own. */
  protected readonly untuned = computed(
    () =>
      JSON.stringify(this.look()) === JSON.stringify(MENU_LOOK) &&
      JSON.stringify(this.layout()) === JSON.stringify(untunedMargins(this.layout())),
  );
  private readonly tweaks = inject(Tweaks);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly cancelDialog = viewChild.required<ChoiceDialog>('cancelDialog');
  private readonly handlesView = viewChild('onMenu', { read: Handles });
  /** What the editor started with, to bring back if the changes are cancelled. */
  private original: { readonly look: MenuLook; readonly layout: Layout } | undefined;

  ngOnInit(): void {
    this.original = { look: this.look(), layout: this.layout() };
  }

  /** Picks no part out, on a tap on none, nor on any of the editor's buttons. */
  protected unpick(event: Event): void {
    if (event.target === this.host) {
      this.picked.set(undefined);
    }
  }

  /** Colors the icon's light, saving each change, as the color picker moves. */
  protected setIconLightColor(color: string): void {
    this.look.set(withIconLight(this.look(), { color }));
    this.save();
  }

  /** Asks whether to cancel the changes; asked already, goes on editing. */
  askToCancel(): void {
    const dialog = this.cancelDialog();
    if (dialog.isOpen) {
      void dialog.close();
    } else {
      dialog.open();
    }
  }

  protected save(): void {
    void this.tweaks.setMenu(this.look());
    void this.tweaks.setLayout(this.layout());
  }

  /** Brings back the menu's own look and the game's own margins, which cancelling the changes undoes, as any change. */
  protected reset(): void {
    this.look.set(MENU_LOOK);
    this.layout.set(untunedMargins(this.layout(), this.handlesView()?.sizes()));
    this.save();
  }

  /** Brings back what the editor started with, and is done. */
  protected cancel(): void {
    void this.cancelDialog().close();
    if (this.original !== undefined) {
      this.look.set(this.original.look);
      this.layout.set(this.original.layout);
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
}
