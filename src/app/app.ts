import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Background } from './ui/background';
import { Tweaks } from './developer-mode/tweaks';
import { layoutStyles } from './ui/layout';
import { Vibrator } from './feedback/vibrator';
import { Speaker } from './feedback/speaker';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
  host: {
    // No long-press menu anywhere, nor the vibration Android gives it: the game is played by tapping and holding keys.
    // Text fields keep theirs, to paste into them.
    '(document:contextmenu)': 'contextMenu($event)',
    // Nor can links and images be dragged away with the mouse, as a button slid on would be.
    '(document:dragstart)': '$event.preventDefault()',
    '(document:pointerover)': 'hover($event)',
    // Every button vibrates as it's clicked.
    '(document:click)': 'vibrator.clicked($event)',
    // The audio gets ready on the first tap or key, those browsers let it start on, before the first sound.
    '(document:pointerup)': 'speaker.warmUp()',
    '(document:keydown)': 'speaker.warmUp()',
  },
})
export class App {
  protected readonly background = inject(Background);
  protected readonly tweaks = inject(Tweaks);
  protected readonly vibrator = inject(Vibrator);
  protected readonly speaker = inject(Speaker);
  /** The margins and corner buttons of every screen (see `layout.ts`). */
  protected readonly layout = computed(() => layoutStyles(this.tweaks.layout()));

  /**
   * A mouse or a stylus over a candy button gives it the focus, as in a game's menu, where they and the keys pick out
   * the same button, one at a time (see `Candy`): only a solid one, that can take the focus, or holds what does, such
   * as a spinner. Other buttons hover as usual.
   */
  protected hover(event: PointerEvent): void {
    const candy =
      event.target instanceof Element
        ? event.target.closest('.candy:not(.clear, .unfocusable)')
        : null;
    // A finger is over a button only as it touches it, to press it.
    if (event.pointerType === 'touch' || candy === null) {
      return;
    }
    // A candy label stands for the input within it, and a candy part of a button for what it holds, such as a spinner.
    const button = candy.matches('a, button')
      ? candy
      : candy.querySelector('input, [tabindex]:not([tabindex="-1"])');
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
