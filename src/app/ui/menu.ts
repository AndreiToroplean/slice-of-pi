import { CdkContextMenuTrigger, CdkMenu, CdkMenuTrigger } from '@angular/cdk/menu';
import { ConnectedPosition } from '@angular/cdk/overlay';
import {
  afterNextRender,
  booleanAttribute,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
} from '@angular/core';

/** How far a menu stands off the button it opens from. */
const GAP = 6;

/** A menu under a button, lined up with its left edge, its corner pointing at it square (see `styles.css`). */
const UNDER_LEFT: ConnectedPosition = {
  originX: 'start',
  originY: 'bottom',
  overlayX: 'start',
  overlayY: 'top',
  offsetY: GAP,
  panelClass: 'menu-corner-top-left',
};
const UNDER_RIGHT: ConnectedPosition = {
  originX: 'end',
  originY: 'bottom',
  overlayX: 'end',
  overlayY: 'top',
  offsetY: GAP,
  panelClass: 'menu-corner-top-right',
};
const OVER_LEFT: ConnectedPosition = {
  originX: 'start',
  originY: 'top',
  overlayX: 'start',
  overlayY: 'bottom',
  offsetY: -GAP,
  panelClass: 'menu-corner-bottom-left',
};
const OVER_RIGHT: ConnectedPosition = {
  originX: 'end',
  originY: 'top',
  overlayX: 'end',
  overlayY: 'bottom',
  offsetY: -GAP,
  panelClass: 'menu-corner-bottom-right',
};

/**
 * Where a menu opens from a button: under it, lined up with its left edge or, where that doesn't fit, its right one, or
 * over it where there's no room under it.
 */
const BUTTON_POSITIONS = [UNDER_LEFT, UNDER_RIGHT, OVER_LEFT, OVER_RIGHT];

/**
 * Where a menu opens from a ⋮ button, which sits at the end of what it's for, in a corner or at the end of a strip: as
 * from any button, but lined up with its right edge first, toward what it's for.
 */
export const MORE_POSITIONS = [UNDER_RIGHT, UNDER_LEFT, OVER_RIGHT, OVER_LEFT];

/** Where a context menu opens from the point pressed: under it and to its right, or where that doesn't fit, flipped. */
const POINT_POSITIONS: ConnectedPosition[] = [
  {
    originX: 'start',
    originY: 'top',
    overlayX: 'start',
    overlayY: 'top',
    panelClass: 'menu-corner-top-left',
  },
  {
    originX: 'start',
    originY: 'top',
    overlayX: 'end',
    overlayY: 'top',
    panelClass: 'menu-corner-top-right',
  },
  {
    originX: 'start',
    originY: 'top',
    overlayX: 'start',
    overlayY: 'bottom',
    panelClass: 'menu-corner-bottom-left',
  },
  {
    originX: 'start',
    originY: 'top',
    overlayX: 'end',
    overlayY: 'bottom',
    panelClass: 'menu-corner-bottom-right',
  },
];

/**
 * A menu (`ng-template` holding an `appDropdown`), opened by the button this is on: the CDK's menu trigger, placing it as
 * our menus open (`BUTTON_POSITIONS`), or, from a ⋮ (`appMenuTriggerMore`), as from a ⋮ (`MORE_POSITIONS`). The menu is
 * given what's in `appMenuTriggerData`, as its template's context.
 */
@Directive({
  selector: '[appMenuTrigger]',
  hostDirectives: [
    {
      directive: CdkMenuTrigger,
      inputs: ['cdkMenuTriggerFor: appMenuTrigger', 'cdkMenuTriggerData: appMenuTriggerData'],
    },
  ],
})
export class MenuTrigger {
  /** Whether the button is a ⋮, at the end of what it's for, such as one in a screen's corner that isn't a `MoreButton`. */
  readonly more = input(false, { alias: 'appMenuTriggerMore', transform: booleanAttribute });

  constructor() {
    const trigger = inject(CdkMenuTrigger, { self: true });
    effect(() => {
      trigger.menuPosition = this.more() ? MORE_POSITIONS : BUTTON_POSITIONS;
    });
  }
}

/**
 * A context menu (`ng-template` holding an `appDropdown`) for the element this is on, as the browser asks for it: a long
 * press on Android, a right click, or the keyboard's menu key. It opens where it was asked for, given what's in
 * `appContextMenuData`, as its template's context. iOS tells no long press to web pages, so what a context menu holds
 * needs another way to it too, such as a ⋮ button (`MoreButton`).
 */
@Directive({
  selector: '[appContextMenu]',
  hostDirectives: [
    {
      directive: CdkContextMenuTrigger,
      inputs: [
        'cdkContextMenuTriggerFor: appContextMenu',
        'cdkContextMenuTriggerData: appContextMenuData',
      ],
    },
  ],
})
export class ContextMenu {
  constructor() {
    inject(CdkContextMenuTrigger, { self: true }).menuPosition = POINT_POSITIONS;
  }
}

/**
 * A menu: the CDK's, as a frosted dropdown (see `.dropdown` in `styles.css`) of `cdkMenuItem` buttons and links,
 * `cdkMenuItemCheckbox` toggles, `cdkMenuItemRadio` choices, and `hr` lines between them. The CDK places it by what
 * opened it, closes it on a tap outside it, on Escape or once an item is chosen, and moves through its items with the
 * arrow keys. It grows from its corner pointing at what it opened from, which is square.
 */
@Directive({
  selector: '[appDropdown]',
  hostDirectives: [CdkMenu],
  host: { class: 'dropdown' },
})
export class Dropdown {
  constructor() {
    const menu = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // Once the CDK has placed it: where it is in the window, for it to draw the season background under it there.
    afterNextRender({
      read: () => {
        const pane = menu.closest('.cdk-overlay-pane')?.getBoundingClientRect();
        menu.style.setProperty('--window-x', `${String(pane?.left ?? 0)}px`);
        menu.style.setProperty('--window-y', `${String(pane?.top ?? 0)}px`);
      },
    });
  }
}
