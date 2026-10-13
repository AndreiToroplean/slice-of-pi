import { Component, ElementRef, input, signal, viewChild } from '@angular/core';

/** Tells overflow menus apart, so that each button opens its own. */
let menus = 0;

/**
 * A small frosted ⋮ button opening an overflow menu: a frosted dropdown under it, holding what is given to it (links,
 * buttons and toggles, see `.dropdown` in `styles.css`). The browser closes it on a tap outside or on Escape; choosing
 * one of its buttons closes it too.
 */
@Component({
  selector: 'app-overflow-menu',
  host: { '(click)': 'chosen($event)' },
  template: `
    <button
      #more
      type="button"
      class="frosted more"
      [attr.aria-label]="label()"
      [attr.popovertarget]="id"
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
      [style.top.px]="dropdownAt().top"
      [style.right.px]="dropdownAt().right"
      (beforetoggle)="place()"
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
export class OverflowMenu {
  /** What the button and the menu are called for screen readers. */
  readonly label = input('More');

  protected readonly id = `overflow-menu-${String(++menus)}`;
  /** Where the dropdown opens, from the top right corner of the window, just under its button. */
  protected readonly dropdownAt = signal({ top: 0, right: 0 });
  private readonly more = viewChild.required<ElementRef<HTMLButtonElement>>('more');
  private readonly dropdown = viewChild.required<ElementRef<HTMLElement>>('dropdown');

  /** Puts the dropdown under its button. It opens in the top layer, positioned against the window. */
  protected place(): void {
    const button = this.more().nativeElement.getBoundingClientRect();
    this.dropdownAt.set({
      top: button.bottom + 6,
      right: document.documentElement.clientWidth - button.right,
    });
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
