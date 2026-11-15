import { Component, computed, input } from '@angular/core';
import icons from './icons.json';

/**
 * The game's icons, by what they stand for, and the Material Symbols drawing them: rounded and filled, from the
 * game's own cut of their font (see `scripts/make-icon-font.py`, to run whenever this changes).
 */
const ICONS = icons;

/** The name of one of the game's icons. */
export type IconName = keyof typeof ICONS;

/** The Material Symbol drawing an icon, by the name its font writes it with. */
export function symbolOf(name: IconName): string {
  return ICONS[name];
}

/**
 * One of the game's icons, from Material Symbols, as large as the text around it and in its color, for a button or a
 * label whose words say what it means: hidden from screen readers. Its font writes it as its symbol's name, which the
 * page's text leaves out, being drawn before it. The browser matches the symbol's optical size to the size it's drawn
 * at, and its grade, by `--icon-grade`, to what it's drawn on: -25, glaring less, for a light icon on a dark
 * background, as by default; 0 for a dark one on a light background.
 */
@Component({
  selector: 'app-icon',
  host: { 'aria-hidden': 'true', '[attr.data-symbol]': 'symbol()' },
  template: '',
  styles: `
    :host {
      display: inline-block;
      flex-shrink: 0;
      width: 1em;
      height: 1em;
      vertical-align: -0.125em;
      font-family: 'Material Symbols Rounded';
      /* At its own size, rather than scaled to the x-height the page matches every font's to. */
      font-size-adjust: none;
      font-weight: normal;
      font-style: normal;
      font-variation-settings: 'GRAD' var(--icon-grade, -25);
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      white-space: nowrap;
      direction: ltr;
      -webkit-font-smoothing: antialiased;
    }

    :host::before {
      content: attr(data-symbol);
      display: block;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  protected readonly symbol = computed(() => symbolOf(this.name()));
}
