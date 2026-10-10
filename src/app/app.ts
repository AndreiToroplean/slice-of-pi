import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Background } from './background/background';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly background = inject(Background);
}
