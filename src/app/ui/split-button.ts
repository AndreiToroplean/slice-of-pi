import {
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Candy, CandyLook } from './candy';
import { CandyGroup } from './candy-group';

/** How long the tray takes to stretch down, or back up, in ms. */
export const TRAY_STRETCH = 140;
/** How long the buttons it holds take to rise out of it, or sink back, in ms: as long as a candy button's press. */
export const ITEMS_RISE = 80;

/**
 * A candy button split in two (see `CandyGroup`): what it does, given, and on its right a small button opening a
 * dropdown under it, laid over what's below, holding the buttons given besides, one or more, as tall as it. Under them
 * all, a tray in the color of their edge, a tad darker, ties them together: opening, it stretches down to make room
 * for them, and once it has, they rise out of it, fading in; closing, they sink back, fading out, and then it goes
 * back up. Its small button stays pressed in while it's open, and pressing it again closes it. Open, or closing, it's
 * over the buttons after it. What closes it otherwise, such as a press elsewhere, is for what holds it to say.
 */
@Component({
  selector: 'app-split-button',
  exportAs: 'splitButton',
  imports: [Candy, CandyGroup],
  host: {
    '[class.primary]': "look() === 'primary'",
    '[class.open]': 'open()',
    '[class.stretched]': 'stretched()',
    '[class.risen]': 'risen()',
    '[style.--items]': 'items()',
    '[style.--tray-stretch]': 'trayStretch',
    '[style.--items-rise]': 'itemsRise',
  },
  template: `
    <div class="tray"></div>
    <app-candy-group>
      <ng-content select="[appCandy]" />
      @if (openable()) {
        <button
          type="button"
          [appCandy]="look()"
          class="toggle"
          [title]="label()"
          [attr.aria-expanded]="open()"
          [pressed]="open() || undefined"
          (click)="toggle()"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
        </button>
      }
    </app-candy-group>
    <div #dropdown class="below" [attr.inert]="risen() ? null : ''">
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      --tray: color-mix(in oklab, var(--candy-edge), #000000 8%);
      --depth: 0.3125rem;
      --gap: var(--split-gap, 0.75rem);
      position: relative;
      z-index: 0;
      display: block;
      transition: z-index 0s var(--tray-stretch);
    }

    :host(.primary) {
      --tray: color-mix(in oklab, var(--candy-primary-edge), #000000 8%);
    }

    :host(.stretched) {
      z-index: 1;
      transition-delay: 0s;
    }

    /*
     * At the buttons' base: as a button pressed all the way is, its top sunk by its depth but a sixteenth of a rem, its
     * bottom that of a button's edge (see \`candy.css\`).
     */
    .tray {
      position: absolute;
      inset: calc(var(--depth) - 0.0625rem) 0 calc(-1 * var(--depth));
      border-radius: var(--radius-key);
      background: var(--tray);
      transition: bottom var(--tray-stretch) var(--ease);
    }

    :host(.stretched) .tray {
      bottom: calc(-1 * var(--items) * (100% + var(--gap)) - var(--depth));
    }

    .toggle {
      --candy-padding-inline: 0.5rem;
    }

    .toggle svg {
      display: block;
      width: 1.25rem;
      height: 1.25rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .below {
      position: absolute;
      top: calc(100% + var(--gap));
      inset-inline: 0;
      display: grid;
      gap: var(--gap);
      visibility: hidden;
      opacity: 0;
      transition: opacity var(--items-rise) var(--ease);
    }

    :host(.stretched) .below {
      visibility: visible;
    }

    :host(.risen) .below {
      opacity: 1;
    }
  `,
})
export class SplitButton {
  readonly look = input<CandyLook>('white');
  /** What its small button is called, for screen readers and as a tooltip. */
  readonly label = input.required<string>();
  /** Whether it has its small button, opening the dropdown: without, it's what it does alone. */
  readonly openable = input(true);
  /** Whether it's open, or opening. */
  readonly open = model(false);

  protected readonly trayStretch = `${String(TRAY_STRETCH)}ms`;
  protected readonly itemsRise = `${String(ITEMS_RISE)}ms`;
  /** Whether the tray is stretched down, as the dropdown opens, while it's open, and until it has closed. */
  protected readonly stretched = signal(false);
  /**
   * Whether the buttons in the dropdown have risen out of the tray, once it has stretched down: until then, they show
   * pressed into it, as told.
   */
  readonly risen = signal(false);
  /** How many buttons the dropdown holds, for the tray to make room for. */
  protected readonly items = signal(1);
  private readonly dropdown = viewChild.required<ElementRef<HTMLElement>>('dropdown');
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const open = this.open();
      untracked(() => {
        this.move(open);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
    });
  }

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  /** Opens: the tray stretches, then the buttons rise; or closes: they sink, then the tray goes back up. */
  private move(open: boolean): void {
    clearTimeout(this.timer);
    if (open) {
      this.items.set(Math.max(1, this.dropdown().nativeElement.children.length));
      this.stretched.set(true);
      this.timer = setTimeout(() => {
        this.risen.set(true);
      }, TRAY_STRETCH);
    } else {
      this.risen.set(false);
      this.timer = setTimeout(() => {
        this.stretched.set(false);
      }, ITEMS_RISE);
    }
  }
}
