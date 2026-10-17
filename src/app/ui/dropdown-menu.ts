import { Component, ElementRef, input, viewChild } from '@angular/core';

/** Tells menus apart, so that each button opens its own, and each menu opens from its own anchor. */
let menus = 0;

/**
 * A small frosted ⋮ button opening a menu: a frosted dropdown under it, holding what is given to it (links, buttons and
 * toggles, see `.dropdown` in `styles.css`). The browser places it, closes it on a tap outside or on Escape; choosing
 * one of its buttons closes it too.
 */
@Component({
  selector: 'app-dropdown-menu',
  host: { '(click)': 'chosen($event)' },
  template: `
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
    <div
      #dropdown
      class="dropdown"
      popover
      role="group"
      [id]="id"
      [attr.aria-label]="label()"
      [style.position-anchor]="anchor"
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
  `,
})
export class DropdownMenu {
  /** What the button and the menu are called for screen readers. */
  readonly label = input('More');

  protected readonly id = `menu-${String(++menus)}`;
  /** What the dropdown opens from: its button. */
  protected readonly anchor = `--${this.id}`;
  private readonly dropdown = viewChild.required<ElementRef<HTMLElement>>('dropdown');

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
