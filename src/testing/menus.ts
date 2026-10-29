/** The menu open last (see `Dropdown`), wherever the CDK put it, or null when none is. */
export function openMenu(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>('.dropdown')).at(-1) ?? null;
}

/** The names of the items of the menu open last. */
export function menuItems(): string[] {
  return Array.from(openMenu()?.querySelectorAll('[role^="menuitem"]') ?? [], (item) =>
    item.textContent.trim().replace(/\s+/g, ' '),
  );
}

/** The item of the menu open last whose name starts so, as a screen reader would find it. */
export function menuItem(name: string): HTMLElement {
  const found = Array.from(
    openMenu()?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [],
  ).find((item) => item.textContent.trim().startsWith(name));
  if (found === undefined) {
    throw new Error(`No menu item "${name}" in ${JSON.stringify(menuItems())}`);
  }
  return found;
}
