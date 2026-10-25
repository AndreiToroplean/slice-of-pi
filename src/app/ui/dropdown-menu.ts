import { NgTemplateOutlet } from '@angular/common';
import { Component, DOCUMENT, ElementRef, inject, input, viewChild } from '@angular/core';
import { ArrowFocus } from './arrow-focus';
import { Candy } from './candy';

/** Tells menus apart, so that each button opens its own, and each menu opens from its own anchor. */
let menus = 0;

/**
 * A menu: a frosted dropdown holding what is given to it (links, buttons and toggles, see `.dropdown` in `styles.css`),
 * opened by a ⋮ button of its own, for a screen's corner or, plain, at the end of a strip of tabs, or without it, from a
 * button elsewhere, which only needs to be its `popovertarget`, or where something was pressed (`openAt`). A button
 * opening it closes it too. The browser places it by the button or the point pressed, and closes it on a tap outside or
 * on Escape; choosing one of its buttons closes it too. It grows from, and shrinks back to, its corner pointing at where
 * it opened from. It opens ready for the keyboard: up and down move between its items, and Enter on a toggle flips it
 * and closes the menu, as on a button.
 */
@Component({
  selector: 'app-dropdown-menu',
  imports: [ArrowFocus, Candy, NgTemplateOutlet],
  // Without its button, only an anchor and the menu, which the browser places: no place of its own where it's put.
  host: {
    '(click)': 'chosen($event)',
    '(keydown.enter)': 'toggle($event)',
    '[style.display]': "button() ? null : 'contents'",
    '[class.plain]': 'plain()',
  },
  template: `
    @if (button() && plain()) {
      <button
        #more
        type="button"
        class="more"
        [title]="label()"
        [attr.popovertarget]="id"
        [style.anchor-name]="anchor"
      >
        <ng-container [ngTemplateOutlet]="dots" />
      </button>
    } @else if (button()) {
      <button
        #more
        type="button"
        appCandy="clear"
        class="corner more"
        [title]="label()"
        [attr.popovertarget]="id"
        [style.anchor-name]="anchor"
      >
        <ng-container [ngTemplateOutlet]="dots" />
      </button>
    } @else {
      <span #point class="point" [style.anchor-name]="anchor"></span>
    }
    <div
      #dropdown
      appArrowFocus
      class="dropdown"
      [class.at-point]="!button()"
      popover
      role="group"
      [id]="id"
      [attr.aria-label]="label()"
      [style.position-anchor]="button() ? anchor : null"
      (beforetoggle)="beforeToggle($event)"
      (toggle)="toggled($event)"
    >
      <ng-content />
    </div>
    <ng-template #dots>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="5.5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="18.5" r="2" />
      </svg>
    </ng-template>
  `,
  styles: `
    .more svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: currentColor;
    }

    /* Plain, as the tabs not chosen are, within their strip: it opens a menu rather than a tab. */
    :host(.plain) {
      display: flex;
    }

    :host(.plain) .more {
      display: grid;
      place-items: center;
      width: 2.25rem;
      margin: 0.1875rem;
      margin-inline-start: 0;
      padding: 0;
      border: none;
      border-radius: 0.8125rem;
      background: none;
      color: inherit;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    :host(.plain) .more:active {
      background: var(--frost-pressed);
    }

    :host(.plain) .more:focus-visible {
      outline: 0.1875rem solid transparent;
      box-shadow: var(--selected-glow);
    }

    /* Where it was opened, for it to open from. */
    .point {
      position: fixed;
    }
  `,
})
export class DropdownMenu {
  /** What the button and the menu are called for screen readers. */
  readonly label = input('More');
  /** Whether it has its ⋮ button. Without it, it opens with `openAt`. */
  readonly button = input(true);
  /** Whether its button is plain, as within a strip of tabs, rather than a candy button for a screen's corner. */
  readonly plain = input(false);

  /**
   * For a button elsewhere to open it, as its `popovertarget`: the browser then anchors the menu to it, as it does to
   * whatever opens a popover.
   */
  readonly id = `menu-${String(++menus)}`;
  /** What the dropdown opens from, when not a button elsewhere: its own button, or the point where it was opened. */
  protected readonly anchor = `--${this.id}`;
  private readonly point = viewChild<ElementRef<HTMLElement>>('point');
  private readonly more = viewChild<string, ElementRef<HTMLElement>>('more', { read: ElementRef });
  private readonly dropdown = viewChild.required<ElementRef<HTMLElement>>('dropdown');
  private readonly items = viewChild.required(ArrowFocus);
  private readonly document = inject(DOCUMENT);
  /** Whether it was last opened at a point, rather than by a button elsewhere. */
  private atPoint = false;

  /** Opens the menu from a point, in window coordinates. */
  openAt(at: { readonly x: number; readonly y: number }): void {
    const point = this.point()?.nativeElement;
    if (point === undefined) {
      return;
    }
    // Fixed, but within a dialog card (whose frost and scale hold fixed elements) from the card rather than the window:
    // placed from where it lands at 0, 0.
    point.style.left = point.style.top = '0px';
    const origin = point.getBoundingClientRect();
    point.style.left = `${String(at.x - origin.left)}px`;
    point.style.top = `${String(at.y - origin.top)}px`;
    const dropdown = this.dropdown().nativeElement;
    dropdown.style.setProperty('position-anchor', this.anchor);
    this.atPoint = true;
    dropdown.showPopover();
    // Laid out as it opens, so that it grows from the right corner from the start.
    this.noteCorner();
  }

  /**
   * Tells the dropdown where it opened in the window, for it to draw the season background under it where it is (see
   * `.dropdown` in `styles.css`), and which of its corners points at what it opened from, which is square. Once open,
   * its first item takes the focus, so that the keyboard goes on from the menu.
   */
  protected toggled(event: Event): void {
    const dropdown = this.dropdown().nativeElement;
    dropdown.style.setProperty('--window-x', `${String(dropdown.offsetLeft)}px`);
    dropdown.style.setProperty('--window-y', `${String(dropdown.offsetTop)}px`);
    if ((event as ToggleEvent).newState === 'open') {
      this.noteCorner();
      this.items().focusFirst();
    } else {
      this.atPoint = false;
    }
  }

  /** Opened by a button elsewhere, anchored to it rather than to the point it was last opened at. */
  protected beforeToggle(event: Event): void {
    if ((event as ToggleEvent).newState === 'open' && !this.atPoint && !this.button()) {
      this.dropdown().nativeElement.style.removeProperty('position-anchor');
    }
  }

  /** Notes which of its corners points at what it opened from: square, and where it grows from and shrinks to. */
  private noteCorner(): void {
    const dropdown = this.dropdown().nativeElement;
    const anchor = (
      this.more()?.nativeElement ??
      (this.atPoint
        ? this.point()?.nativeElement
        : this.document.querySelector(`[popovertarget="${this.id}"]`))
    )?.getBoundingClientRect();
    if (anchor !== undefined) {
      const box = dropdown.getBoundingClientRect();
      // Over it if past its top edge; the corner on the side nearer the middle of it, wherever the menu fitted.
      const above = box.top < anchor.top;
      const middle = anchor.left + anchor.width / 2;
      const left = Math.abs(box.right - middle) < Math.abs(box.left - middle);
      dropdown.dataset['corner'] = `${above ? 'bottom' : 'top'}-${left ? 'right' : 'left'}`;
    }
  }

  /** Flips a toggle on Enter, which browsers leave to Space, and closes the menu, as a button chosen does. */
  protected toggle(event: Event): void {
    const toggle = event.target;
    if (
      toggle instanceof HTMLInputElement &&
      toggle.type === 'checkbox' &&
      this.dropdown().nativeElement.contains(toggle)
    ) {
      event.preventDefault();
      toggle.click();
      this.dropdown().nativeElement.hidePopover();
    }
  }

  /** Closes the menu once one of its buttons is chosen. */
  protected chosen(event: Event): void {
    const dropdown = this.dropdown().nativeElement;
    if (
      event.target instanceof Element &&
      dropdown.contains(event.target) &&
      event.target.closest('button') !== null
    ) {
      dropdown.hidePopover();
    }
  }
}
