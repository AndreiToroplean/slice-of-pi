import { Directive, output } from '@angular/core';

/**
 * A request for an element's context menu, as the browser tells it: a long press on Android, as long as the system
 * has it, a right click, or the keyboard's menu key. Its own menu never opens (see `App`). It's told where it was, in
 * window coordinates. A mouse held down is no long press: it's a click. iOS tells no long press to web pages, so what
 * a context menu holds needs another way to it too, such as a ⋮ button (`MoreButton`).
 */
@Directive({
  selector: '[appContextMenu]',
  host: { '(contextmenu)': 'request($event)' },
})
export class ContextMenu {
  readonly appContextMenu = output<{ readonly x: number; readonly y: number }>();

  protected request(event: MouseEvent): void {
    this.appContextMenu.emit({ x: event.clientX, y: event.clientY });
  }
}
