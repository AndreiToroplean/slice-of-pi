/** How wide a segmented control's pill's rounded ends are, in tests, where nothing is laid out. */
const END = 13;

/** Gives the rounded ends of the pill of the segmented controls in `host` their width, as if laid out. */
export function roundEnds(host: Element): void {
  for (const end of host.querySelectorAll('.pill-part.start')) {
    Object.defineProperty(end, 'offsetWidth', { value: END });
  }
}

/** Where a segmented control's pill is, from where its rounded ends are moved (see `roundEnds`). */
export function pillBox(host: Element): { readonly left: number; readonly width: number } {
  const at = (part: string): number =>
    Number(
      /translateX\(([-\d.]+)px\)/.exec(
        host.querySelector<HTMLElement>(`.pill-part.${part}`)?.style.transform ?? '',
      )?.[1] ?? NaN,
    );
  return { left: at('start'), width: at('end') + END - at('start') };
}
