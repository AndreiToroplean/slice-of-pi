/**
 * Gives elements the `showPopover` and `hidePopover` methods jsdom lacks, showing a popover by marking it
 * `data-popover-open`, displaying it over jsdom's hiding it, so that what it holds can take the focus, and telling its
 * `beforetoggle` and `toggle` events as browsers do. A button with a `popovertarget` opens and closes its popover once
 * pressed, after what it does itself, as in browsers. Undo with `uninstallPopovers`.
 */
export function installPopovers(): void {
  HTMLElement.prototype.showPopover = function (this: HTMLElement): void {
    this.dispatchEvent(Object.assign(new Event('beforetoggle'), { newState: 'open' }));
    this.toggleAttribute('data-popover-open', true);
    this.style.display = 'block';
    this.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' }));
  };
  HTMLElement.prototype.hidePopover = function (this: HTMLElement): void {
    if (this.hasAttribute('data-popover-open')) {
      this.dispatchEvent(Object.assign(new Event('beforetoggle'), { newState: 'closed' }));
      this.removeAttribute('data-popover-open');
      this.style.removeProperty('display');
      this.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'closed' }));
    }
  };
  document.addEventListener('click', invoke);
}

export function uninstallPopovers(): void {
  Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
  Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');
  document.removeEventListener('click', invoke);
}

/** Opens or closes the popover of the button pressed, if it has one. */
function invoke(event: Event): void {
  const id =
    event.target instanceof Element
      ? event.target.closest('button[popovertarget]')?.getAttribute('popovertarget')
      : undefined;
  const popover = id === undefined || id === null ? null : document.getElementById(id);
  if (popover?.hasAttribute('data-popover-open') === true) {
    popover.hidePopover();
  } else {
    popover?.showPopover();
  }
}
