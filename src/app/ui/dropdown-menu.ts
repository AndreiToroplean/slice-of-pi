import { Component, ElementRef, input, viewChild } from '@angular/core';
import { ArrowFocus } from './arrow-focus';

/** Tells menus apart, so that each button opens its own, and each menu opens from its own anchor. */
let menus = 0;

/**
 * A menu: a frosted dropdown holding what is given to it (links, buttons and toggles, see `.dropdown` in `styles.css`),
 * opened by a small frosted ⋮ button, or, without it, where something was pressed (`openAt`). The browser places it,
 * closes it on a tap outside or on Escape; choosing one of its buttons closes it too. It opens ready for the keyboard:
 * up and down move between its items, and Enter on a toggle flips it and closes the menu, as on a button.
 */
@Component({
  selector: 'app-dropdown-menu',
  imports: [ArrowFocus],
  // Without its button, only an anchor and the menu, which the browser places: no place of its own where it's put.
  host: {
    '(click)': 'chosen($event)',
    '(keydown.enter)': 'toggle($event)',
    '[style.display]': "button() ? null : 'contents'",
  },
  template: `
    @if (button()) {
      <button
        type="button"
        class="frosted more"
        [attr.aria-label]="label()"
        [attr.popovertarget]="id"
        [style.anchor-name]="anchor"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="5.5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="18.5" r="2" />
        </svg>
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
      [style.position-anchor]="anchor"
      (toggle)="toggled($event)"
    >
      <ng-content />
    </div>
  `,
  styles: `
    .more {
      display: grid;
      place-items: center;
      width: 2.75rem;
      height: 2.75rem;
      padding: 0;
      border-radius: 50%;
    }

    .more svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: currentColor;
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

  protected readonly id = `menu-${String(++menus)}`;
  /** What the dropdown opens from: its button, or the point where it was opened. */
  protected readonly anchor = `--${this.id}`;
  private readonly point = viewChild<ElementRef<HTMLElement>>('point');
  private readonly dropdown = viewChild.required<ElementRef<HTMLElement>>('dropdown');
  private readonly items = viewChild.required(ArrowFocus);

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
    this.dropdown().nativeElement.showPopover();
  }

  /**
   * Tells the dropdown where it opened in the window, for it to draw the season background under it where it is (see
   * `.dropdown` in `styles.css`). Once open, its first item takes the focus, so that the keyboard goes on from the menu.
   */
  protected toggled(event: Event): void {
    const dropdown = this.dropdown().nativeElement;
    dropdown.style.setProperty('--window-x', `${String(dropdown.offsetLeft)}px`);
    dropdown.style.setProperty('--window-y', `${String(dropdown.offsetTop)}px`);
    if ((event as ToggleEvent).newState === 'open') {
      this.items().focusFirst();
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
