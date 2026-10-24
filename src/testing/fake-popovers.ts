/**
 * Gives elements the `showPopover` and `hidePopover` methods jsdom lacks, showing a popover by marking it
 * `data-popover-open`, displaying it over jsdom's hiding it, so that what it holds can take the focus, and telling its
 * `toggle` event as browsers do; undo with `uninstallPopovers`.
 */
export function installPopovers(): void {
  HTMLElement.prototype.showPopover = function (this: HTMLElement): void {
    this.toggleAttribute('data-popover-open', true);
    this.style.display = 'block';
    this.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' }));
  };
  HTMLElement.prototype.hidePopover = function (this: HTMLElement): void {
    if (this.hasAttribute('data-popover-open')) {
      this.removeAttribute('data-popover-open');
      this.style.removeProperty('display');
      this.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'closed' }));
    }
  };
}

export function uninstallPopovers(): void {
  Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
  Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');
}
