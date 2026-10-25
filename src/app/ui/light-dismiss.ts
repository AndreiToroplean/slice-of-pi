import { Directive, ElementRef, inject } from '@angular/core';

/**
 * A modal dialog that closes on a click outside it, on its backdrop, as on Escape: `<dialog closedby="any">`. Browsers
 * that don't know `closedby` yet close it here instead.
 */
@Directive({
  // On the native attribute itself, so that no dialog asking for light dismiss misses the fallback.
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'dialog[closedby=any]',
  host: { '(click)': 'onClick($event)' },
})
export class LightDismiss {
  private readonly dialog = inject<ElementRef<HTMLDialogElement>>(ElementRef).nativeElement;

  protected onClick(event: MouseEvent): void {
    // A click on the backdrop lands on the dialog itself, outside its box.
    if ('closedBy' in HTMLDialogElement.prototype || event.target !== this.dialog) {
      return;
    }
    const box = this.dialog.getBoundingClientRect();
    const inside =
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom;
    if (!inside) {
      this.dialog.close();
    }
  }
}
