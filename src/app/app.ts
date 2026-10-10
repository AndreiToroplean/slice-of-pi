import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Background } from './background/background';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
  host: {
    // No long-press menu anywhere, nor the vibration Android gives it: the game is played by tapping and holding keys.
    '(document:contextmenu)': '$event.preventDefault()',
  },
})
export class App {
  protected readonly background = inject(Background);
}
