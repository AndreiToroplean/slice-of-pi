import { DOCUMENT } from '@angular/common';
import { Component, computed, ElementRef, inject, input, viewChild } from '@angular/core';

/** A line between the items of a context menu, drawn only where it has items on both sides. */
export const SEPARATOR = 'separator';

/** An item of a context menu: its label, and what choosing it does. */
export interface MenuItem {
  readonly label: string;
  readonly action: () => void;
}

export type MenuEntry = MenuItem | typeof SEPARATOR;

/**
 * The entries a context menu shows: its items, and each separator that has an item on both sides of it, only once
 * between the same two items, so that a menu whose items come and go can always list every separator it may need.
 */
export function shownEntries(entries: readonly MenuEntry[]): MenuEntry[] {
  const shown: MenuEntry[] = [];
  for (const entry of entries) {
    if (entry !== SEPARATOR || (shown.length > 0 && shown.at(-1) !== SEPARATOR)) {
      shown.push(entry);
    }
  }
  if (shown.at(-1) === SEPARATOR) {
    shown.pop();
  }
  return shown;
}

/**
 * A context menu: a small white sheet of items that opens where something was pressed, staying within the window, and
 * closes once an item is chosen, or on a tap outside or Escape.
 */
@Component({
  selector: 'app-context-menu',
  template: `
    <div #sheet class="sheet" popover>
      @for (entry of shown(); track $index) {
        @if (entry === separator) {
          <hr />
        } @else {
          <button type="button" (click)="choose(entry)">{{ entry.label }}</button>
        }
      }
    </div>
  `,
  styleUrl: './context-menu.css',
})
export class ContextMenu {
  readonly entries = input.required<readonly MenuEntry[]>();

  protected readonly separator = SEPARATOR;
  protected readonly shown = computed(() => shownEntries(this.entries()));
  private readonly sheet = viewChild.required<ElementRef<HTMLElement>>('sheet');
  private readonly window = inject(DOCUMENT).defaultView;

  /** Opens the menu just under a point, in window coordinates, or over it if there's no room under it. */
  open(at: { readonly x: number; readonly y: number }): void {
    const sheet = this.sheet().nativeElement;
    sheet.showPopover();
    const width = this.window?.innerWidth ?? Infinity;
    const height = this.window?.innerHeight ?? Infinity;
    const x = Math.max(
      MARGIN,
      Math.min(at.x - sheet.offsetWidth / 2, width - sheet.offsetWidth - MARGIN),
    );
    const under = at.y + GAP;
    const y =
      under + sheet.offsetHeight <= height - MARGIN
        ? under
        : Math.max(MARGIN, at.y - GAP - sheet.offsetHeight);
    sheet.style.left = `${String(x)}px`;
    sheet.style.top = `${String(y)}px`;
    // So that the keyboard goes on from the menu.
    sheet.querySelector('button')?.focus();
  }

  protected choose(item: MenuItem): void {
    this.sheet().nativeElement.hidePopover();
    item.action();
  }
}

/** How close the menu comes to the sides of the window, and how far it opens from the point pressed, in pixels. */
const MARGIN = 12;
const GAP = 8;
