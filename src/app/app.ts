import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Background } from './ui/background';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
  host: {
    // No long-press menu anywhere, nor the vibration Android gives it: the game is played by tapping and holding keys.
    // Text fields keep theirs, to paste into them.
    '(document:contextmenu)': 'contextMenu($event)',
    '(document:pointerover)': 'hover($event)',
  },
})
export class App {
  protected readonly background = inject(Background);

  /**
   * A mouse over a candy button gives it the focus, as in a game's menu, where the mouse and the keys pick out the same
   * button, one at a time (see `Candy`). Other buttons hover as usual.
   */
  protected hover(event: PointerEvent): void {
    const candy = event.target instanceof Element ? event.target.closest('.candy') : null;
    if (event.pointerType !== 'mouse' || candy === null) {
      return;
    }
    // A candy label stands for the input within it.
    const button = candy.matches('a, button') ? candy : candy.querySelector('input');
    if (button instanceof HTMLElement && !button.matches(':focus')) {
      button.focus({ focusVisible: true });
    }
  }

  protected contextMenu(event: Event): void {
    if (!(
      event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement
    )) {
      event.preventDefault();
    }
  }
}
