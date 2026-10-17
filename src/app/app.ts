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
  },
})
export class App {
  protected readonly background = inject(Background);

  protected contextMenu(event: Event): void {
    if (!(
      event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement
    )) {
      event.preventDefault();
    }
  }
}
