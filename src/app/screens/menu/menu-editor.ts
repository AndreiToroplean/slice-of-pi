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
import { Tweaks } from '../../developer-mode/tweaks';
import { ButtonList } from '../../ui/button-list';
import { Candy } from '../../ui/candy';
import { CopyValues } from '../tuning/copy-values';
import {
  LAYOUT_FIELDS,
  LIGHT_FIELDS,
  LightLayer,
  LookField,
  MENU_LOOK,
  MenuLayout,
  MenuLook,
  withLayout,
  withLight,
} from './menu-look';

/** A group of sliders: what it's called, and what each of its sliders reads and sets. */
interface Group {
  readonly title: string;
  readonly fields: readonly Slider[];
}

/** A slider: the value it shows, and how it reads and sets it. */
interface Slider {
  readonly field: Omit<LookField<object>, 'key'> & { readonly key: string };
  readonly get: (look: MenuLook) => number;
  readonly set: (look: MenuLook, value: number) => MenuLook;
}

const PARTS: readonly (readonly [keyof MenuLayout, string])[] = [
  ['icon', 'Icon'],
  ['slice', '“Slice of”'],
  ['pi', '“Pi”'],
  ['buttons', 'Buttons'],
];

const LAYERS: readonly (readonly [LightLayer, string])[] = [
  ['icon', 'Icon Light'],
  ['slice', '“Slice of” Light'],
  ['pi', '“Pi” Light'],
];

/** Every slider of the editor, the layout's first, then each layer's light, from the back. */
const GROUPS: readonly Group[] = [
  ...PARTS.map(([part, title]): Group => ({
    title,
    fields: LAYOUT_FIELDS[part].map((field: Slider['field']): Slider => ({
      field,
      get: (look) => (look.layout[part] as Readonly<Record<string, number>>)[field.key] ?? 0,
      set: (look, value) =>
        withLayout(look, part, field.key as keyof MenuLayout[typeof part], value),
    })),
  })),
  ...LAYERS.map(([layer, title]): Group => ({
    title,
    fields: LIGHT_FIELDS.map((field) => ({
      field,
      get: (look) => look.light[layer][field.key],
      set: (look, value) => withLight(look, layer, field.key, value),
    })),
  })),
];

/**
 * Developer mode's editor of the main menu, over it: a slider for each size and height of its parts, which always stay
 * centered across, and for each value of the light of each of its layers. The menu shows each change at once, and it's
 * saved, as a tweak, as each slider is let go. Done ends it; Cancel, or Escape, asks whether to cancel the changes,
 * bringing back the look it started with, or to go on editing. Reset brings back the menu's own look, and Copy copies
 * the look, to go into the code. A toggle hides the sliders, to preview the menu as it is, and shows them again.
 */
@Component({
  selector: 'app-menu-editor',
  imports: [ButtonList, Candy, CopyValues],
  host: { '(document:keydown.escape)': 'escape($event)' },
  template: `
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
      <app-copy-values label="Copy" [values]="{ menu: look() }" />
      <button type="button" appCandy="primary" (click)="done.emit()">Done</button>
    </div>
    @if (!previewing()) {
      <div class="panel">
        @for (group of groups; track group.title; let first = $first) {
          <details [open]="first">
            <summary>{{ group.title }}</summary>
            @for (each of group.fields; track each.field.key) {
              <label class="field">
                <span>{{ each.field.label }}</span>
                <input
                  type="range"
                  [min]="each.field.min"
                  [max]="each.field.max"
                  [step]="each.field.step"
                  [value]="each.get(look())"
                  (input)="set(each, $event)"
                  (change)="save()"
                />
                <output>{{ each.get(look()) }}</output>
              </label>
            }
          </details>
        }
      </div>
    }
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
  styleUrl: './menu-editor.css',
})
export class MenuEditor implements OnInit {
  /** The look edited, shown on the menu as it changes. */
  readonly look = model.required<MenuLook>();
  /** The player is done editing, keeping the changes or cancelling them. */
  readonly done = output();
  /** Whether the sliders are hidden, for the menu to show as it is. */
  readonly previewing = model(false);

  protected readonly groups = GROUPS;
  /** Whether the look is the menu's own. */
  protected readonly untuned = computed(
    () => JSON.stringify(this.look()) === JSON.stringify(MENU_LOOK),
  );
  private readonly tweaks = inject(Tweaks);
  private readonly cancelDialog = viewChild.required<ElementRef<HTMLDialogElement>>('cancelDialog');
  /** The look the editor started with, to bring back if the changes are cancelled. */
  private original: MenuLook | undefined;

  ngOnInit(): void {
    this.original = this.look();
  }

  /** Asks whether to cancel the changes; asked already, goes on editing. */
  askToCancel(): void {
    const dialog = this.cancelDialog().nativeElement;
    if (dialog.open) {
      dialog.close();
    } else {
      dialog.showModal();
    }
  }

  protected set(slider: Slider, event: Event): void {
    this.look.set(slider.set(this.look(), (event.target as HTMLInputElement).valueAsNumber));
  }

  protected save(): void {
    void this.tweaks.setMenu(this.look());
  }

  /** Brings back the menu's own look, which cancelling the changes undoes, as any change. */
  protected reset(): void {
    this.look.set(MENU_LOOK);
    this.save();
  }

  /** Brings back the look the editor started with, and is done. */
  protected cancel(): void {
    this.cancelDialog().nativeElement.close();
    if (this.original !== undefined) {
      this.look.set(this.original);
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
}
