/**
 * Gives dialogs the `showModal` and `close` methods jsdom lacks, opening and closing them at once, without animations;
 * undo with `uninstallDialogs`.
 */
export function installDialogs(): void {
  HTMLDialogElement.prototype.getAnimations = (): Animation[] => [];
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
    if (this.open) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    }
  };
}

export function uninstallDialogs(): void {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'getAnimations');
}

/** The dialog within `host` named so: its title, the element its `aria-labelledby` names, says so. */
export function dialogNamed(host: ParentNode, name: string): HTMLDialogElement {
  const found = Array.from(host.querySelectorAll('dialog')).find((dialog) => {
    const title = dialog.getAttribute('aria-labelledby');
    return title !== null && dialog.querySelector(`#${title}`)?.textContent.trim() === name;
  });
  if (found === undefined) {
    throw new Error(`No dialog named ${name}`);
  }
  return found;
}
